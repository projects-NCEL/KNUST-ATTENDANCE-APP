/**
 * KNUST ATTENDANCE APP is 100% free and open for university faculty and students.
 * Billing has been completely removed.
 */
export const PAYMENTS_LIVE = false;
export const IS_TOTALLY_FREE = true;

export const TRIAL_DAYS = 999999;

export type PlanCode = "free";

export const PLANS: {
  code: PlanCode;
  name: string;
  amountGhs: number;
  cadence: string;
  note: string;
  highlight?: boolean;
  features: string[];
}[] = [
  {
    code: "free",
    name: "University Free & Open Access",
    amountGhs: 0,
    cadence: "Completely Free Forever",
    note: "Full unconstrained access for all KNUST faculty, staff, and students.",
    highlight: true,
    features: [
      "100% Free — Zero fees, zero subscriptions",
      "Unlimited courses & class sessions",
      "Unlimited students & attendance QR codes",
      "Live projector dynamic QR code check-in",
      "High-speed multi-camera attendance scanner",
      "Automated continuous assessment (10-mark grading)",
      "Instant Excel, CSV & PDF report downloads",
      "Offline sync mode with zero data loss",
    ],
  },
];

