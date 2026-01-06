import React, { useState } from "react";
import { Card } from "../Common/Card";
import { Button, Modal } from "../index";
import { FormField } from "../Common/Input";

const PricingModal = ({ isOpen, onClose, product, onPay }) => {
  const [paymentData, setPaymentData] = useState({});
  const [isPaying, setIsPaying] = useState(false);

  const handleChange = (key, value) => {
    setPaymentData((prev) => ({ ...prev, [key]: value }));
  };

  const handlePayment = async () => {
    try {
      setIsPaying(true);
      await onPay(paymentData);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={!isPaying ? onClose : undefined}
      title="Checkout"
      size="full"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isPaying}>
            Cancel
          </Button>
          <Button
            onClick={handlePayment}
            disabled={isPaying}
            className="flex items-center gap-2"
          >
            {isPaying ? "Processing..." : `Pay ${product.price}`}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="glow" padding="md">
          <h3 className="text-lg font-semibold text-white">{product.name}</h3>

          {product.description && (
            <p className="mt-2 text-sm text-white/60">{product.description}</p>
          )}

          {product.features?.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              {product.features.map((feature, i) => (
                <li key={i}>
                  {" "}
                  <span className="text-2xl">&rarr;</span> {feature}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-sm text-white/60">Total</p>
            <p className="text-2xl font-bold text-purpleGlow">
              {product.currency}
              {product.price}
            </p>
            {product.billingNote && (
              <p className="text-xs text-white/40">{product.billingNote}</p>
            )}
          </div>
        </Card>

        {/* Payment Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Payment details</h3>

          <FormField
            label="Cardholder Name"
            placeholder="John Doe"
            onChange={(e) => handleChange("name", e.target.value)}
          />

          <FormField
            label="Card Number"
            placeholder="1234 5678 9012 3456"
            onChange={(e) => handleChange("cardNumber", e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Expiry"
              placeholder="MM / YY"
              onChange={(e) => handleChange("expiry", e.target.value)}
            />
            <FormField
              label="CVV"
              type="password"
              placeholder="•••"
              onChange={(e) => handleChange("cvv", e.target.value)}
            />
          </div>

          <p className="text-xs text-white/40">
            Secure payment &bull; Encrypted &bull; PCI-DSS compliant
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default PricingModal;
