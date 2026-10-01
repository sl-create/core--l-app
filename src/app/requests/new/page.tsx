import Link from "next/link";
import { createRequest } from "../../actions";
import { DOCUMENT_LABELS, DOCUMENT_TYPES } from "@/lib/domain/documents";
import { LOCATION_LABELS, LOCATIONS } from "@/lib/domain/locations";
import { LEVEL_INFO, LEVELS } from "@/lib/domain/levels";
import { requireUser } from "@/lib/server/session";
import { ErrorBanner, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default async function NewRequestPage({ searchParams }: PageProps<"/requests/new">) {
  await requireUser();
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Send a document" subtitle="Tell us what needs moving and when it has to arrive." />
      <ErrorBanner message={error} />
      <form action={createRequest} className="card space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="documentType">Document</label>
            <select className="input" id="documentType" name="documentType" required>
              {DOCUMENT_TYPES.map((d) => (
                <option key={d} value={d}>{DOCUMENT_LABELS[d]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="minLevel">Who can carry it</label>
            <select className="input" id="minLevel" name="minLevel" defaultValue="ARINRIN_AJO">
              <option value="ARINRIN_AJO">Any verified traveller</option>
              {LEVELS.slice(1).map((l) => (
                <option key={l} value={l}>
                  {LEVEL_INFO[l].name} ({LEVEL_INFO[l].meaning}) and above
                </option>
              ))}
            </select>
            <p className="hint">
              Reserve important documents for experienced travellers. <Link href="/levels" className="link">About levels</Link>
            </p>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="description">Details (optional)</label>
          <textarea className="input" id="description" name="description" rows={2} placeholder="e.g. One A4 envelope, sealed" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="origin">From</label>
            <select className="input" id="origin" name="origin" defaultValue="LAGOS">
              {LOCATIONS.map((l) => <option key={l} value={l}>{LOCATION_LABELS[l]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="destination">To</label>
            <select className="input" id="destination" name="destination" defaultValue="LONDON">
              {LOCATIONS.map((l) => <option key={l} value={l}>{LOCATION_LABELS[l]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pickupCity">Where the document is now</label>
            <input className="input" id="pickupCity" name="pickupCity" required placeholder="e.g. Ikeja, Lagos" />
            <p className="hint">Share the exact address only with your matched traveller.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="availableFrom">Ready for handover from (UTC)</label>
            <input className="input" id="availableFrom" name="availableFrom" type="datetime-local" required />
          </div>
          <div>
            <label className="label" htmlFor="deadline">Must arrive by (UTC)</label>
            <input className="input" id="deadline" name="deadline" type="datetime-local" required />
            <p className="hint">Closer deadlines cost more and have shorter claim windows.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="recipientName">Recipient name</label>
            <input className="input" id="recipientName" name="recipientName" required />
          </div>
          <div>
            <label className="label" htmlFor="recipientPhone">Recipient phone</label>
            <input className="input" id="recipientPhone" name="recipientPhone" type="tel" required />
          </div>
        </div>
        <SubmitButton>Post request</SubmitButton>
      </form>
    </div>
  );
}
