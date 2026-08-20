import axios from 'axios';
import { getFrontendUrl } from '../utils/frontend.js';

const describeGatewayError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return {
      message: error.message,
      status: error.response?.status,
      response: error.response?.data,
    };
  }

  return { message: error instanceof Error ? error.message : String(error) };
};

// Paystack Payment Service
export class PaystackService {
  private baseUrl = 'https://api.paystack.co';
  private secretKey: string;
  private bankCache: Array<{ name: string; code: string }> | null = null;
  private bankCacheExpiresAt = 0;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  async getBanks(): Promise<Array<{ name: string; code: string }>> {
    if (this.bankCache && this.bankCacheExpiresAt > Date.now()) {
      return this.bankCache;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/bank`, {
        params: { country: 'nigeria', currency: 'NGN', perPage: 100 },
        headers: { Authorization: `Bearer ${this.secretKey}` },
      });

      const banks = Array.isArray(response.data?.data)
        ? response.data.data
            .filter((bank: any) => bank?.name && bank?.code)
            .map((bank: any) => ({ name: String(bank.name), code: String(bank.code) }))
        : [];

      if (!banks.length) {
        throw new Error('Paystack returned no Nigerian banks');
      }

      this.bankCache = banks;
      this.bankCacheExpiresAt = Date.now() + 60 * 60 * 1000;
      return banks;
    } catch (error) {
      console.error('[paystack] bank list failed:', describeGatewayError(error));
      throw error;
    }
  }

  async resolveBankCode(bankName: string): Promise<string | undefined> {
    const normalizedName = bankName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const banks = await this.getBanks();
    const bank = banks.find((item) => {
      const candidate = item.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return candidate === normalizedName || candidate.includes(normalizedName) || normalizedName.includes(candidate);
    });
    return bank?.code;
  }

  async initializeTransaction(
    email: string,
    amount: number,
    metadata: Record<string, any>,
    callbackUrl?: string
  ): Promise<{ authorization_url: string; access_code: string; reference: string }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount: Math.round(amount * 100), // Paystack uses kobo (1/100 of Naira)
          metadata,
          callback_url: callbackUrl || `${getFrontendUrl()}/payment/callback?provider=paystack`,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status) {
        return {
          authorization_url: response.data.data.authorization_url,
          access_code: response.data.data.access_code,
          reference: response.data.data.reference,
        };
      }

      throw new Error('Failed to initialize Paystack transaction');
    } catch (error) {
      console.error('[paystack] initialize failed:', describeGatewayError(error));
      throw error;
    }
  }

  async verifyTransaction(reference: string): Promise<{
    status: boolean;
    message: string;
    data?: Record<string, any>;
  }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );

      return {
        status: response.data.data.status === 'success',
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      console.error('[paystack] verify failed:', describeGatewayError(error));
      throw error;
    }
  }

  async createTransferRecipient(
    type: string,
    accountNumber: string,
    bankCode: string,
    name: string
  ): Promise<{ recipient_code: string }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transferrecipient`,
        {
          type,
          account_number: accountNumber,
          bank_code: bankCode,
          name,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status) {
        return { recipient_code: response.data.data.recipient_code };
      }

      throw new Error('Failed to create transfer recipient');
    } catch (error) {
      console.error('[paystack] transfer recipient failed:', describeGatewayError(error));
      throw error;
    }
  }

  async initiateTransfer(
    recipient: string,
    amount: number,
    reason?: string
  ): Promise<{ transfer_code: string; reference: string }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transfer`,
        {
          source: 'balance',
          recipient,
          amount: Math.round(amount * 100),
          reason,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status) {
        return {
          transfer_code: response.data.data.transfer_code,
          reference: response.data.data.reference,
        };
      }

      throw new Error('Failed to initiate transfer');
    } catch (error) {
      console.error('[paystack] transfer failed:', describeGatewayError(error));
      throw error;
    }
  }
}

// Flutterwave Payment Service
export class FlutterwaveService {
  private baseUrl = 'https://api.flutterwave.com/v3';
  private secretKey: string;
  private publicKey: string;

  constructor(secretKey: string, publicKey: string) {
    this.secretKey = secretKey;
    this.publicKey = publicKey;
  }

  async initializePayment(
    email: string,
    amount: number,
    txRef: string,
    metadata: Record<string, any>,
    currency: string = 'NGN',
    callbackUrl?: string
  ): Promise<{ link: string; order_ref: string }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/payments`,
        {
          tx_ref: txRef,
          amount,
          currency,
          redirect_url: callbackUrl || `${getFrontendUrl()}/payment/callback?provider=flutterwave`,
          customer: {
            email,
          },
          customizations: {
            title: 'MarketConnect Payment',
            description: 'Purchase from MarketConnect',
            logo: `${getFrontendUrl()}/logo.png`,
          },
          meta: metadata,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status === 'success') {
        return {
          link: response.data.data.link,
          order_ref: response.data.data.order_ref,
        };
      }

      throw new Error('Failed to initialize Flutterwave payment');
    } catch (error) {
      console.error('[flutterwave] initialize failed:', describeGatewayError(error));
      throw error;
    }
  }

  async verifyTransaction(txRef: string): Promise<{
    status: boolean;
    message: string;
    data?: Record<string, any>;
  }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transactions/verify_by_reference?tx_ref=${txRef}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );

      if (response.data.status === 'success') {
        const transaction = response.data.data;
        return {
          status: transaction.status === 'successful',
          message: response.data.message,
          data: transaction,
        };
      }

      return {
        status: false,
        message: response.data.message,
      };
    } catch (error) {
      console.error('[flutterwave] verify failed:', describeGatewayError(error));
      throw error;
    }
  }

  async createTransfer(
    accountBank: string,
    accountNumber: string,
    amount: number,
    narration: string,
    reference: string
  ): Promise<{ transfer_id: number; status: string }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transfers`,
        {
          account_bank: accountBank,
          account_number: accountNumber,
          amount,
          narration,
          reference,
          currency: 'NGN',
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status === 'success') {
        return {
          transfer_id: response.data.data.id,
          status: response.data.data.status,
        };
      }

      throw new Error('Failed to create Flutterwave transfer');
    } catch (error) {
      console.error('[flutterwave] transfer failed:', describeGatewayError(error));
      throw error;
    }
  }
}
