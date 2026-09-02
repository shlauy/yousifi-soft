package com.alyousifisoft.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.text.TextUtils;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "BackupDirectory")
public class BackupDirectoryPlugin extends Plugin {

    @PluginMethod
    public void pickDirectory(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );
        startActivityForResult(call, intent, "directoryPicked");
    }

    @ActivityCallback
    private void directoryPicked(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("BACKUP_DIRECTORY_CANCELLED");
            return;
        }

        Intent resultIntent = result.getData();
        Uri treeUri = resultIntent.getData();
        try {
            int takeFlags = resultIntent.getFlags()
                & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            getContext().getContentResolver().takePersistableUriPermission(treeUri, takeFlags);
        } catch (SecurityException ignored) {
            // Some document providers do not offer persistable permissions. The current
            // selection still works for this session and the web layer reports failures.
        }

        JSObject response = new JSObject();
        response.put("uri", treeUri.toString());
        response.put("name", displayName(treeUri));
        call.resolve(response);
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String suggestedName = call.getString("suggestedName", "yousifi-backup.json");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, suggestedName);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        startActivityForResult(call, intent, "filePicked");
    }

    @ActivityCallback
    private void filePicked(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("BACKUP_FILE_CANCELLED");
            return;
        }

        Uri fileUri = result.getData().getData();
        try {
            writeUri(fileUri, call.getString("data", ""));
            JSObject response = new JSObject();
            response.put("uri", fileUri.toString());
            response.put("name", displayName(fileUri));
            call.resolve(response);
        } catch (FileNotFoundException error) {
            call.reject("BACKUP_FILE_NOT_FOUND", error);
        } catch (IOException error) {
            call.reject("BACKUP_FILE_WRITE_FAILED", error);
        } catch (Exception error) {
            call.reject("BACKUP_FILE_WRITE_FAILED", error);
        }
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        String tree = call.getString("uri");
        String name = call.getString("name");
        if (TextUtils.isEmpty(tree) || TextUtils.isEmpty(name)) {
            call.reject("BACKUP_DIRECTORY_INPUT_INVALID");
            return;
        }

        try {
            Uri fileUri = findOrCreateChild(Uri.parse(tree), name);
            writeUri(fileUri, call.getString("data", ""));
            JSObject response = new JSObject();
            response.put("uri", fileUri.toString());
            response.put("name", name);
            call.resolve(response);
        } catch (FileNotFoundException error) {
            call.reject("BACKUP_DIRECTORY_FILE_NOT_FOUND", error);
        } catch (IOException error) {
            call.reject("BACKUP_DIRECTORY_WRITE_FAILED", error);
        } catch (Exception error) {
            call.reject("BACKUP_DIRECTORY_WRITE_FAILED", error);
        }
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        String tree = call.getString("uri");
        String name = call.getString("name");
        if (TextUtils.isEmpty(tree) || TextUtils.isEmpty(name)) {
            call.reject("BACKUP_DIRECTORY_INPUT_INVALID");
            return;
        }

        try {
            Uri fileUri = findChild(Uri.parse(tree), name);
            if (fileUri == null) {
                call.reject("BACKUP_FILE_NOT_FOUND");
                return;
            }
            JSObject response = new JSObject();
            response.put("data", readUri(fileUri));
            call.resolve(response);
        } catch (FileNotFoundException error) {
            call.reject("BACKUP_FILE_NOT_FOUND", error);
        } catch (IOException error) {
            call.reject("BACKUP_DIRECTORY_READ_FAILED", error);
        } catch (Exception error) {
            call.reject("BACKUP_DIRECTORY_READ_FAILED", error);
        }
    }

    @PluginMethod
    public void listFiles(PluginCall call) {
        String tree = call.getString("uri");
        if (TextUtils.isEmpty(tree)) {
            call.reject("BACKUP_DIRECTORY_INPUT_INVALID");
            return;
        }

        try {
            Uri treeUri = Uri.parse(tree);
            Uri documentUri = treeDocumentUri(treeUri);
            Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
                treeUri,
                DocumentsContract.getDocumentId(documentUri)
            );
            String[] projection = {
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
                DocumentsContract.Document.COLUMN_SIZE,
                DocumentsContract.Document.COLUMN_LAST_MODIFIED,
            };
            JSArray files = new JSArray();
            try (Cursor cursor = getContext().getContentResolver().query(childrenUri, projection, null, null, null)) {
                if (cursor != null) {
                    int idIndex = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID);
                    int nameIndex = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
                    int mimeIndex = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE);
                    int sizeIndex = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_SIZE);
                    int modifiedIndex = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED);
                    while (cursor.moveToNext()) {
                        String mime = mimeIndex >= 0 ? cursor.getString(mimeIndex) : "";
                        if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) continue;
                        String documentId = cursor.getString(idIndex);
                        JSObject file = new JSObject();
                        file.put("name", cursor.getString(nameIndex));
                        file.put("uri", DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId).toString());
                        file.put("modifiedAt", modifiedIndex >= 0 && !cursor.isNull(modifiedIndex) ? cursor.getLong(modifiedIndex) : 0);
                        file.put("size", sizeIndex >= 0 && !cursor.isNull(sizeIndex) ? cursor.getLong(sizeIndex) : 0);
                        files.put(file);
                    }
                }
            }
            JSObject response = new JSObject();
            response.put("files", files);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("BACKUP_DIRECTORY_LIST_FAILED", error);
        }
    }

    @PluginMethod
    public void deleteFile(PluginCall call) {
        String tree = call.getString("uri");
        String name = call.getString("name");
        if (TextUtils.isEmpty(tree) || TextUtils.isEmpty(name)) {
            call.reject("BACKUP_DIRECTORY_INPUT_INVALID");
            return;
        }

        try {
            Uri fileUri = findChild(Uri.parse(tree), name);
            if (fileUri != null && !DocumentsContract.deleteDocument(getContext().getContentResolver(), fileUri)) {
                call.reject("BACKUP_FILE_DELETE_FAILED");
                return;
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("BACKUP_FILE_DELETE_FAILED", error);
        }
    }

    private Uri treeDocumentUri(Uri treeUri) {
        return DocumentsContract.buildDocumentUriUsingTree(
            treeUri,
            DocumentsContract.getTreeDocumentId(treeUri)
        );
    }

    private Uri findOrCreateChild(Uri treeUri, String name) throws FileNotFoundException {
        Uri existing = findChild(treeUri, name);
        if (existing != null) return existing;
        Uri parentUri = treeDocumentUri(treeUri);
        Uri created = DocumentsContract.createDocument(
            getContext().getContentResolver(),
            parentUri,
            "application/json",
            name
        );
        if (created == null) throw new IllegalStateException("Unable to create backup file");
        return created;
    }

    private Uri findChild(Uri treeUri, String name) {
        Uri documentUri = treeDocumentUri(treeUri);
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
            treeUri,
            DocumentsContract.getDocumentId(documentUri)
        );
        String[] projection = {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        };
        try (Cursor cursor = getContext().getContentResolver().query(childrenUri, projection, null, null, null)) {
            if (cursor == null) return null;
            int idIndex = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID);
            int nameIndex = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
            while (cursor.moveToNext()) {
                if (name.equals(cursor.getString(nameIndex))) {
                    return DocumentsContract.buildDocumentUriUsingTree(treeUri, cursor.getString(idIndex));
                }
            }
        }
        return null;
    }

    private void writeUri(Uri uri, String data) throws IOException {
        try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (output == null) throw new IllegalStateException("Unable to open backup file");
            output.write(data.getBytes(StandardCharsets.UTF_8));
            output.flush();
        }
    }

    private String readUri(Uri uri) throws IOException {
        try (InputStream input = getContext().getContentResolver().openInputStream(uri);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalStateException("Unable to open backup file");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private String displayName(Uri uri) {
        String[] projection = { DocumentsContract.Document.COLUMN_DISPLAY_NAME };
        try (Cursor cursor = getContext().getContentResolver().query(uri, projection, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                String name = cursor.getString(0);
                if (!TextUtils.isEmpty(name)) return name;
            }
        } catch (Exception ignored) {
            // The URI remains a valid persisted identifier even without a display name.
        }
        return uri.toString();
    }
}