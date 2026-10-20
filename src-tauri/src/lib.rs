use tauri::{
    menu::Menu,
    webview::{NewWindowResponse, WebviewWindowBuilder},
    Url, WebviewUrl,
};
use tauri_plugin_opener::OpenerExt;

/// Le shell desktop charge l’application hébergée : elle se met ainsi à jour
/// toute seule et garde le proxy InnerTube du Worker. En développement, il
/// charge le serveur Vite local pour profiter du HMR.
const PRODUCTION_URL: &str = "https://site-837caca50a67485a994f4549b9ef7404.freebuff.page/";
const DEV_URL: &str = "http://127.0.0.1:5183/";

/// Origines autorisées à naviguer dans la webview. Les cadres YouTube en font
/// partie : le lecteur officiel est un iframe, et WebKit applique le filtre de
/// navigation aux sous-cadres comme à la page principale.
const FRAME_HOSTS: &[&str] = &[
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
    "accounts.google.com",
    "consent.youtube.com",
    "www.google.com",
    "apis.google.com",
    "ytimg.com",
    "i.ytimg.com",
    "s.ytimg.com",
    "googlevideo.com",
    "gstatic.com",
    "googleapis.com",
    "doubleclick.net",
];

fn host_matches(host: &str, allowed: &str) -> bool {
    host == allowed || host.ends_with(&format!(".{allowed}"))
}

fn is_app_origin(url: &Url) -> bool {
    let Some(host) = url.host_str() else {
        return matches!(url.scheme(), "about" | "blob" | "data" | "tauri");
    };

    if matches!(url.scheme(), "tauri" | "about" | "blob" | "data") {
        return true;
    }

    let origin = format!(
        "{}://{}{}",
        url.scheme(),
        host,
        url.port().map(|port| format!(":{port}")).unwrap_or_default()
    );

    origin == "https://site-837caca50a67485a994f4549b9ef7404.freebuff.page"
        || origin == "http://127.0.0.1:5183"
        || origin == "http://localhost:5183"
}

fn is_frame_url(url: &Url) -> bool {
    if is_app_origin(url) {
        return true;
    }
    let Some(host) = url.host_str() else {
        return true;
    };
    FRAME_HOSTS.iter().any(|allowed| host_matches(host, allowed))
}

/// Ouvre un lien hors de l’app dans le navigateur par défaut.
fn open_in_browser(app: &tauri::AppHandle, url: &Url) {
    if matches!(url.scheme(), "http" | "https") {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let new_window_handle = handle.clone();

            // `TUBECRAFT_START_URL` sert aux tests et aux builds de démo :
            // il permet d’ouvrir directement une page (lecture, recherche…).
            let start_url = std::env::var("TUBECRAFT_START_URL").unwrap_or_else(|_| {
                if cfg!(debug_assertions) {
                    DEV_URL.to_string()
                } else {
                    PRODUCTION_URL.to_string()
                }
            });

            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(start_url.parse().expect("URL de démarrage invalide")),
            )
            .title("Séquence")
            .inner_size(1440.0, 900.0)
            .min_inner_size(960.0, 640.0)
            .center()
            .accept_first_mouse(true)
            // Les liens externes (YouTube, GitHub, vitrine) partent dans le
            // navigateur ; les cadres du lecteur restent dans l’app.
            .on_navigation(|url| is_frame_url(url))
            .on_new_window(move |url, _features| {
                open_in_browser(&new_window_handle, &url);
                NewWindowResponse::Deny
            })
            .build()?;

            app.set_menu(Menu::default(&handle)?)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Séquence");
}
