/**
 * Builds a UPI payment deep link (upi://pay?...). Opening this URL on
 * a phone brings up the UPI app chooser (PhonePe, Google Pay, Paytm,
 * etc.) with the payee, amount, and note already filled in — this is
 * the standard way to accept UPI payments without integrating a paid
 * gateway SDK.
 */
export function buildUpiLink({ payeeUpiId, payeeName, amount, note }) {
  const params = new URLSearchParams({
    pa: payeeUpiId,
    pn: payeeName,
    am: String(amount),
    cu: "INR",
  });
  if (note) params.set("tn", note);
  return `upi://pay?${params.toString()}`;
}
