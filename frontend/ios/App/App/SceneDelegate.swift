import UIKit
import Capacitor

// Delegado de la escena.
//
// Desde el SDK de iOS 27 (Xcode 27) UIKit exige el ciclo de vida por escenas:
// la ventana y el controlador de Capacitor se crean aquí, no en el AppDelegate.
// Una app compilada con ese SDK que no lo traiga la cierra el sistema nada más
// abrirla; es lo que le pasó a la 1.3.7.
//
// Lo que antes llegaba al AppDelegate y ahora llega aquí: el paso a primer
// plano (applicationDidBecomeActive ya no se llama) y los enlaces que abren la
// app. Los avisos push siguen en el AppDelegate: APNs es de la app entera, no
// de la escena.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // El backend manda badge: 1 con cada aviso; si nadie lo pone a cero, el
        // globo se queda en el icono para siempre. Abrir la app es leer los
        // avisos: aquí se limpia.
        UIApplication.shared.applicationIconBadgeNumber = 0
    }

    // Enlaces con esquema propio y enlaces universales. El proxy de Capacitor
    // los reparte a los plugins igual que antes lo hacía el del AppDelegate.
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
