import type { MarsPayment } from './actions.js';

/** Display arithmetic only on the client; the server validates ownership and allowed materials. */
export function marsPaymentValue(spend: MarsPayment, values: { steelValue: 2 | 3; titaniumValue: 3 | 4 | 5 }): number {
    return spend.money + spend.steel * values.steelValue + spend.titanium * values.titaniumValue + spend.heat + (spend.microbes ?? 0) * 2;
}
