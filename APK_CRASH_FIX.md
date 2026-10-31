# Fix crash di APK (sisi native)

Zip ini isinya website (yang dimuat APK lewat WebView), jadi semua fix JS/SW/proxy otomatis ikut ke APK
setelah di-deploy. Source Android-nya tidak ada di zip, jadi bagian di bawah ini TEMPEL MANUAL di project APK kamu.

## 1. Tangani WebView renderer mati (penyebab "crash di hp tertentu")
Tanpa ini, kalau Android membunuh proses renderer WebView (RAM habis), seluruh app ikut crash.

```kotlin
webView.webViewClient = object : WebViewClient() {
    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        // true = app TIDAK crash. Buat ulang WebView, muat lagi; player-guard.js akan memulihkan lagu terakhir.
        (view.parent as? ViewGroup)?.removeView(view)
        view.destroy()
        recreateWebView()          // buat WebView baru + loadUrl(URL_WEBSITE_KAMU)
        return true
    }
}
```

## 2. Biar musik nggak dimatikan Android saat layar mati
- Putar lewat **Foreground Service** bertipe `mediaPlayback` (+ notifikasi), jangan cuma mengandalkan Activity.
- Manifest: `<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/>`
- `webView.settings.mediaPlaybackRequiresUserGesture = false` (biar auto-lanjut setelah recovery bisa jalan)
- Jangan panggil `webView.onPause()` / `pauseTimers()` saat Activity masuk background kalau musik sedang jalan.

## 3. Kasih tahu web saat app kembali dari background
```kotlin
override fun onResume() {
    super.onResume()
    webView.evaluateJavascript("window.HCGuard && HCGuard.onNativeResume()", null)
}
```

## 4. Hemat RAM
`android:largeHeap="true"` di `<application>` dan `webView.settings.cacheMode = WebSettings.LOAD_DEFAULT`.
