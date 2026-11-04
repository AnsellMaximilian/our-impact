export type PayPalButtonActions = {
  restart: () => Promise<void>;
};

export type PayPalButtonsInstance = {
  render: (container: HTMLElement) => Promise<void>;
  close?: () => Promise<void>;
};

export type PayPalNamespace = {
  Buttons: (options: {
    style?: Record<string, string | boolean>;
    createOrder: () => Promise<string>;
    onApprove: (
      data: { orderID: string },
      actions: PayPalButtonActions,
    ) => Promise<void>;
    onCancel: () => void;
    onError: (error: unknown) => void;
    onShippingChange?: (
      data: unknown,
      actions: PayPalButtonActions,
    ) => Promise<void>;
  }) => PayPalButtonsInstance;
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}
