package org.spsm.walletbutton

import android.content.Context
import android.view.ViewGroup
import com.google.android.gms.wallet.button.ButtonConstants
import com.google.android.gms.wallet.button.ButtonOptions
import com.google.android.gms.wallet.button.PayButton
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlin.math.roundToInt

/**
 * Google's own Google Pay button, the Android half of the Apple Pay one.
 *
 * Google Pay's brand guidelines ask for the same thing Apple's do: the wallet
 * is started from its own mark, not from a button in the app's type that says
 * "wallet". `PayButton` is that mark, drawn by Play Services.
 */
class WalletButtonModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WalletButton")

    View(WalletButtonView::class) {
      Events("onWalletPress")

      Prop("kind") { view: WalletButtonView, kind: String? ->
        view.kind = kind ?: "buy"
      }

      Prop("cornerRadius") { view: WalletButtonView, radius: Double? ->
        view.cornerRadius = radius ?: 8.0
      }

      OnViewDidUpdateProps { view: WalletButtonView ->
        view.rebuild()
      }
    }
  }
}

class WalletButtonView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onWalletPress by EventDispatcher()

  var kind = "buy"
  var cornerRadius = 8.0

  private var button: PayButton? = null
  private var built: Pair<String, Double>? = null

  /** Yoga sizes this view; the PayButton inside it has to be laid out by Android. */
  override val shouldUseAndroidLayout = true

  /** `PayButton` is configured once, by `initialize`, so a changed prop means a new one. */
  fun rebuild() {
    val next = kind to cornerRadius
    if (built == next) return
    built = next

    button?.let { removeView(it) }

    val created = PayButton(context)
    created.initialize(
      ButtonOptions.newBuilder()
        // Dark, for the same reason as iOS: the app is light-only.
        .setButtonTheme(ButtonConstants.ButtonTheme.DARK)
        .setButtonType(typeOf(kind))
        .setCornerRadius((cornerRadius * resources.displayMetrics.density).roundToInt())
        .setAllowedPaymentMethods(ALLOWED_PAYMENT_METHODS)
        .build(),
    )
    created.setOnClickListener { onWalletPress(mapOf()) }
    addView(
      created,
      LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    button = created
  }

  private fun typeOf(kind: String): Int =
    when (kind) {
      "checkout" -> ButtonConstants.ButtonType.CHECKOUT
      "continue", "plain" -> ButtonConstants.ButtonType.PLAIN
      else -> ButtonConstants.ButtonType.BUY
    }

  private companion object {
    /*
     * What the button needs to know to draw itself — the card networks, so it
     * can show the person's own card on it. It is not the payment request:
     * Square's SDK builds that, tokenization and all, when the sheet opens.
     */
    const val ALLOWED_PAYMENT_METHODS =
      """[{"type":"CARD","parameters":{"allowedAuthMethods":["PAN_ONLY","CRYPTOGRAM_3DS"],""" +
        """"allowedCardNetworks":["AMEX","DISCOVER","MASTERCARD","VISA"]}}]"""
  }
}
