package com.alyousifisoft.app;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.telephony.SmsManager;
import android.text.TextUtils;
import android.widget.Toast;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

@CapacitorPlugin(
    name = "Messaging",
    permissions = { @Permission(strings = { Manifest.permission.SEND_SMS }, alias = "sms") }
)
public class MessagingPlugin extends Plugin {

    private static final String OFFICIAL_WHATSAPP = "com.whatsapp";
    private static final String BUSINESS_WHATSAPP = "com.whatsapp.w4b";
    private static final String SYSTEM_DEFAULT = "system";

    private boolean isSmsPermissionGranted() {
        return getPermissionState("sms") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void sendSms(PluginCall call) {
        try {
            if (!isSmsPermissionGranted()) {
                requestPermissionForAlias("sms", call, "permissionCallback");
                return;
            }
            sendSmsNow(call);
        } catch (Exception error) {
            call.reject("SMS_SEND_FAILED", error);
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (!isSmsPermissionGranted()) {
            call.reject("SMS_PERMISSION_DENIED");
            return;
        }
        if ("sendSms".equals(call.getMethodName())) {
            sendSmsNow(call);
        } else {
            call.reject("SMS_METHOD_NOT_SUPPORTED");
        }
    }

    private void sendSmsNow(PluginCall call) {
        String phone = call.getString("phone", "");
        String message = call.getString("message", "");
        if (TextUtils.isEmpty(phone) || TextUtils.isEmpty(message)) {
            call.reject("SMS_INPUT_INVALID");
            return;
        }

        String normalizedPhone = phone.replaceAll("[^0-9+]", "");
        if (TextUtils.isEmpty(normalizedPhone)) {
            call.reject("SMS_PHONE_INVALID");
            return;
        }

        try {
            SmsManager smsManager = SmsManager.getDefault();
            ArrayList<String> parts = smsManager.divideMessage(message);
            if (parts.size() == 1) {
                smsManager.sendTextMessage(normalizedPhone, null, message, null, null);
            } else {
                smsManager.sendMultipartTextMessage(normalizedPhone, null, parts, null, null);
            }

            getActivity().runOnUiThread(() ->
                Toast.makeText(getContext(), "تم إرسال رسالة SMS بنجاح", Toast.LENGTH_SHORT).show()
            );
            JSObject response = new JSObject();
            response.put("sent", true);
            call.resolve(response);
        } catch (SecurityException error) {
            call.reject("SMS_PERMISSION_DENIED", error);
        } catch (IllegalArgumentException error) {
            call.reject("SMS_INPUT_INVALID", error);
        } catch (Exception error) {
            call.reject("SMS_SEND_FAILED", error);
        }
    }

    @PluginMethod
    public void openWhatsApp(PluginCall call) {
        String phone = call.getString("phone", "");
        String message = call.getString("message", "");
        String packageName = call.getString("packageName", SYSTEM_DEFAULT);
        if (TextUtils.isEmpty(phone) || TextUtils.isEmpty(message)) {
            call.reject("WHATSAPP_INPUT_INVALID");
            return;
        }
        if (!SYSTEM_DEFAULT.equals(packageName)
            && !OFFICIAL_WHATSAPP.equals(packageName)
            && !BUSINESS_WHATSAPP.equals(packageName)) {
            call.reject("WHATSAPP_PACKAGE_INVALID");
            return;
        }

        String normalizedPhone = phone.replaceAll("[^0-9]", "");
        if (TextUtils.isEmpty(normalizedPhone)) {
            call.reject("WHATSAPP_PHONE_INVALID");
            return;
        }

        Uri uri = Uri.parse("https://wa.me/" + normalizedPhone)
            .buildUpon()
            .appendQueryParameter("text", message)
            .build();
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        if (!SYSTEM_DEFAULT.equals(packageName)) intent.setPackage(packageName);

        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject("WHATSAPP_APP_NOT_FOUND", error);
        } catch (SecurityException error) {
            call.reject("WHATSAPP_OPEN_FAILED", error);
        } catch (Exception error) {
            call.reject("WHATSAPP_OPEN_FAILED", error);
        }
    }
}