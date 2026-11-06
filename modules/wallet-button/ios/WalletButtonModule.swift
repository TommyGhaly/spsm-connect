import ExpoModulesCore
import PassKit

/// Apple's own Apple Pay button, for the screens that offer it.
///
/// App Review asked where the Apple Pay was, because the app said "Pay with
/// wallet" in its own type and nothing on screen looked like Apple Pay. The
/// Human Interface Guidelines are also plain that only `PKPaymentButton` (or
/// SwiftUI's wrapper of it) may start a payment, so this is the button the
/// App Clip already draws — see `ApplePayButton` in BookstoreView.swift.
public final class WalletButtonModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WalletButton")

    View(WalletButtonView.self) {
      Events("onWalletPress")

      Prop("kind") { (view, kind: String?) in
        view.kind = kind ?? "buy"
      }

      Prop("cornerRadius") { (view, radius: Double?) in
        view.cornerRadius = CGFloat(radius ?? 8)
      }

      OnViewDidUpdateProps { view in
        view.rebuild()
      }
    }
  }
}

final class WalletButtonView: ExpoView {
  let onWalletPress = EventDispatcher()

  var kind = "buy"
  var cornerRadius: CGFloat = 8

  private var button: PKPaymentButton?
  private var built: (String, CGFloat)?

  /// `PKPaymentButton`'s type and style are fixed at init, so a changed prop
  /// means a new button rather than a mutation of this one.
  func rebuild() {
    if let built, built == (kind, cornerRadius) { return }
    built = (kind, cornerRadius)

    button?.removeFromSuperview()

    /*
     * Black, always: the app is light-only (`userInterfaceStyle: 'light'`),
     * and black on the cream page is the style Apple recommends there.
     */
    let next = PKPaymentButton(paymentButtonType: Self.type(of: kind), paymentButtonStyle: .black)
    next.cornerRadius = cornerRadius
    next.addTarget(self, action: #selector(pressed), for: .touchUpInside)
    next.frame = bounds
    next.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(next)
    button = next
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button?.frame = bounds
  }

  @objc private func pressed() {
    onWalletPress([:])
  }

  private static func type(of kind: String) -> PKPaymentButtonType {
    switch kind {
    case "checkout": return .checkout
    case "continue": return .continue
    case "plain": return .plain
    default: return .buy
    }
  }
}
