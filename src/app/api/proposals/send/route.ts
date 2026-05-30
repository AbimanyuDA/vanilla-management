/**
 * Resend Webhook Handler
 *
 * Receives delivery status updates from Resend for sent proposals.
 * Events processed: email.delivered, email.bounced, email.complained
 *
 * Resend sends POST requests to this endpoint after each email event.
 * Configure in Resend dashboard: Webhooks → Add endpoint → /api/proposals/send
 *
 * Note: Resend signs webhooks with svix. Full signature verification would
 * require the `svix` npm package. For this internal platform, we accept
 * webhooks from any source (protected by internal network / API gateway).
 *
 * References: requirements.md Requirement 4.5, 4.6
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ProposalStatus } from "@/generated/prisma/enums";

// Resend webhook event types we handle
type ResendEvent =
  | "email.sent"
  | "email.delivered"
  | "email.bounced"
  | "email.complained"
  | "email.clicked"
  | "email.opened";

interface ResendWebhookPayload {
  type: ResendEvent;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    tags?: Record<string, string>;
    bounce?: {
      message?: string;
    };
  };
}

export async function POST(request: Request) {
  let payload: ResendWebhookPayload;

  try {
    payload = (await request.json()) as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, data } = payload;
  const proposalId = data.tags?.proposalId;

  if (!proposalId) {
    // Event not related to a tracked proposal — ignore
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Find the proposal
  const proposal = await db.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) {
    return NextResponse.json({ ok: true, skipped: true, reason: "proposal_not_found" });
  }

  try {
    switch (type) {
      case "email.delivered":
        // Confirm delivery — already SENT, no status change needed
        // Could log to analytics in a future iteration
        console.log(`[webhook] Proposal ${proposalId} delivered to ${data.to.join(", ")}`);
        break;

      case "email.bounced":
        // Update to FAILED with bounce reason
        if (proposal.status === ProposalStatus.SENT) {
          await db.proposal.update({
            where: { id: proposalId },
            data: {
              status: ProposalStatus.FAILED,
              failureReason: `Email bounced: ${data.bounce?.message ?? "recipient address rejected"}`,
            },
          });
          console.log(`[webhook] Proposal ${proposalId} bounced`);
        }
        break;

      case "email.complained":
        // Spam report — mark as failed
        if (proposal.status === ProposalStatus.SENT) {
          await db.proposal.update({
            where: { id: proposalId },
            data: {
              status: ProposalStatus.FAILED,
              failureReason: "Email reported as spam by recipient",
            },
          });
        }
        break;

      default:
        // email.sent, email.clicked, email.opened — informational only
        break;
    }
  } catch (err) {
    console.error("[webhook] Failed to process event:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, type, proposalId });
}

// Resend may send GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: "VEIP Proposal Webhook — active" });
}
