"use server";

export async function toggleKeeper(enabled: boolean) {
  const apiKey = process.env.CRON_JOB_API_KEY;
  const jobId = process.env.CRON_JOB_ID;

  if (!apiKey || !jobId) {
    throw new Error("Missing CRON_JOB_API_KEY or CRON_JOB_ID environment variables.");
  }

  // Cron-Job.org API requires sending the full job object or specific partial updates
  // According to Cron-Job.org API docs for PATCH /jobs/{id}, you can send partial updates.
  const res = await fetch(`https://api.cron-job.org/jobs/${jobId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      job: {
        enabled: enabled
      }
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to toggle cron job: ${errorText}`);
  }

  return { success: true, enabled };
}

export async function getKeeperStatus() {
  const apiKey = process.env.CRON_JOB_API_KEY;
  const jobId = process.env.CRON_JOB_ID;

  if (!apiKey || !jobId) {
    return { enabled: false, configured: false };
  }

  const res = await fetch(`https://api.cron-job.org/jobs/${jobId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    return { enabled: false, configured: true, error: "Failed to fetch status" };
  }

  const data = await res.json();
  return { enabled: data.jobDetails.enabled, configured: true };
}
