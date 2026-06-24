import { logoutAction } from "@/app/actions/auth";
import {
  applyImageCandidateAction,
  createNetworkAction,
  createManualPostAction,
  createTopicAction,
  deletePostAction,
  deleteTopicAction,
  findPexelsImagesAction,
  generateNextTopicPostAction,
  generatePostAction,
  publishPostAction,
  repushPostAction,
  toggleTopicAction,
  updateDraftAction,
  updateNetworkAction,
} from "@/app/actions/networks";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const postingDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const timezones = [
  { label: "Eastern Time (New York)", value: "America/New_York" },
  { label: "Central Time (Chicago)", value: "America/Chicago" },
  { label: "Mountain Time (Denver)", value: "America/Denver" },
  { label: "Mountain Time (Phoenix, no DST)", value: "America/Phoenix" },
  { label: "Pacific Time (Los Angeles)", value: "America/Los_Angeles" },
  { label: "Alaska Time (Anchorage)", value: "America/Anchorage" },
  { label: "Hawaii Time (Honolulu)", value: "Pacific/Honolulu" },
  { label: "Atlantic Time (Halifax)", value: "America/Halifax" },
  { label: "UTC", value: "UTC" },
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "Central Europe (Paris/Berlin)", value: "Europe/Paris" },
  { label: "Eastern Europe (Athens/Helsinki)", value: "Europe/Athens" },
  { label: "Moscow", value: "Europe/Moscow" },
  { label: "India (Mumbai)", value: "Asia/Kolkata" },
  { label: "Singapore / Philippines", value: "Asia/Singapore" },
  { label: "Japan / Korea", value: "Asia/Tokyo" },
  { label: "Australia Eastern (Sydney)", value: "Australia/Sydney" },
  { label: "Australia Central (Adelaide)", value: "Australia/Adelaide" },
  { label: "Australia Western (Perth)", value: "Australia/Perth" },
  { label: "New Zealand (Auckland)", value: "Pacific/Auckland" },
];

type DashboardPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const user = await requireUser();
  const { error } = await searchParams;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://towncrier-production.up.railway.app";
  const networks = await prisma.network.findMany({
    where: { ownerId: user.id },
    include: {
      blogConfig: true,
      topics: {
        orderBy: [
          { isActive: "desc" },
          { useCount: "asc" },
          { createdAt: "asc" },
        ],
      },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          imageCandidates: {
            orderBy: { createdAt: "desc" },
            take: 6,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-8 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Towncrier
            </p>
            <h1 className="mt-3 text-4xl font-semibold">
              Vercel blog hub dashboard
            </h1>
            <p className="mt-2 text-slate-300">Signed in as {user.email}</p>
          </div>
          <form action={logoutAction}>
            <SubmitButton
              className="rounded-full border border-white/20 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
              pendingText="Logging out..."
            >
              Log out
            </SubmitButton>
          </form>
        </header>

        {error ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
            <p className="font-semibold">Generation failed</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[420px_1fr]">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Add a site profile</h2>
            <p className="mt-2 text-sm text-slate-600">
              Save the website profile, location, author, and blog strategy for
              one Vercel site.
            </p>

            <form action={createNetworkAction} className="mt-6 space-y-4">
              <TextInput label="Site name" name="name" required />
              <TextInput
                label="Site slug"
                name="slug"
                placeholder="fairless-hills-chiropractor"
              />
              <TextInput
                label="Domain"
                name="domain"
                placeholder="fairlesshillschiropractor.com"
              />
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Platform
                </span>
                <select
                  name="platform"
                  defaultValue="vercel"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                >
                  <option value="vercel">Vercel / Towncrier API</option>
                  <option value="ghl">Legacy GHL blog</option>
                  <option value="wordpress">WordPress (future)</option>
                </select>
              </label>
              <TextInput label="Location name" name="locationName" />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="City" name="city" />
                <TextInput label="State" name="state" />
              </div>
              <TextInput
                label="Service area"
                name="serviceArea"
                placeholder="Fairless Hills, Levittown, Yardley, Bristol"
              />
              <TextInput label="Author name" name="authorName" />
              <TextInput label="Author title" name="authorTitle" />
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Author bio
                </span>
                <textarea
                  name="authorBio"
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                />
              </label>
              <TextInput label="Author image URL" name="authorImageUrl" />
              <TextInput
                label="Optional site API key"
                name="siteApiKey"
                placeholder="Use the same value in the Vercel site env"
              />
              <TextInput
                label="Vercel revalidate URL"
                name="revalidateUrl"
                placeholder="https://example.com/api/revalidate"
              />
              <TextInput
                label="Vercel revalidate secret"
                name="revalidateSecret"
              />
              <details className="rounded-2xl bg-slate-50 p-4">
                <summary className="cursor-pointer font-semibold">
                  Legacy GHL settings
                </summary>
                <div className="mt-4 space-y-4">
                  <TextInput label="GHL API token" name="apiToken" />
                  <TextInput label="GHL blog ID" name="blogId" />
                  <TextInput label="GHL location ID" name="ghlLocationId" />
                  <TextInput label="GHL company ID" name="ghlCompanyId" />
                </div>
              </details>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Default topic
                </span>
                <textarea
                  required
                  name="defaultTopic"
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                  placeholder="Example: Addiction recovery resources in Bucks County"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Categories
                </span>
                <textarea
                  name="categories"
                  rows={2}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                  placeholder="SEO, recovery, local guide"
                />
              </label>
              <TextInput
                label="Image style"
                name="imageStyle"
                placeholder="Natural editorial image"
              />

              <fieldset>
                <legend className="text-sm font-medium text-slate-700">
                  Posting days
                </legend>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {postingDays.map((day) => (
                    <label
                      key={day}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <input type="checkbox" name="postingDays" value={day} />
                      {day}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Leave all unchecked to post every day.
                </p>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Posting time
                  </span>
                  <input
                    type="time"
                    name="postingTime"
                    defaultValue="08:00"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Time zone
                  </span>
                  <select
                    name="timezone"
                    defaultValue="America/New_York"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                  >
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset className="rounded-2xl bg-slate-50 p-4">
                <legend className="text-sm font-semibold text-slate-800">
                  Automation
                </legend>
                <div className="mt-3 space-y-3">
                  <CheckboxInput
                    label="Enable automated generation workflow"
                    name="automationEnabled"
                  />
                  <CheckboxInput
                    label="Auto-publish generated drafts"
                    name="autoPublishEnabled"
                  />
                  <CheckboxInput
                    defaultChecked
                    label="Auto-select Pexels image"
                    name="autoImageEnabled"
                  />
                </div>
              </fieldset>

              <SubmitButton
                className="w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
                pendingText="Saving profile..."
              >
                Save site profile
              </SubmitButton>
            </form>
          </section>

          <section className="space-y-6">
            {networks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <h2 className="text-2xl font-semibold">
                  Add your first GHL blog network
                </h2>
                <p className="mt-2 text-slate-600">
                  Once a network is saved, you can generate the first Claude
                  draft and publish it from here.
                </p>
              </div>
            ) : (
              networks.map((network) => (
                <article
                  key={network.id}
                  className="rounded-3xl bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
                        {network.platform} / {network.status}
                      </p>
                      <h2 className="mt-2 text-3xl font-semibold">
                        {network.name}
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">
                        Site slug: {network.slug}
                        {network.domain ? ` / ${network.domain}` : ""}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                      {network.posts.length} recent draft
                      {network.posts.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <details className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <summary className="cursor-pointer font-semibold">
                      Edit network settings
                    </summary>
                    <form
                      action={updateNetworkAction}
                      className="mt-4 grid gap-4 md:grid-cols-2"
                    >
                      <input
                        type="hidden"
                        name="networkId"
                        value={network.id}
                      />
                      <TextInput
                        label="Site name"
                        name="name"
                        defaultValue={network.name}
                        required
                      />
                      <TextInput
                        label="Site slug"
                        name="slug"
                        defaultValue={network.slug}
                        required
                      />
                      <TextInput
                        label="Domain"
                        name="domain"
                        defaultValue={network.domain ?? ""}
                      />
                      <label className="block">
                        <span className="text-sm font-medium text-slate-700">
                          Platform
                        </span>
                        <select
                          name="platform"
                          defaultValue={network.platform}
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                        >
                          <option value="vercel">Vercel / Towncrier API</option>
                          <option value="ghl">Legacy GHL blog</option>
                          <option value="wordpress">WordPress (future)</option>
                        </select>
                      </label>
                      <TextInput
                        label="Location name"
                        name="locationName"
                        defaultValue={network.locationName ?? ""}
                      />
                      <TextInput
                        label="City"
                        name="city"
                        defaultValue={network.city ?? ""}
                      />
                      <TextInput
                        label="State"
                        name="state"
                        defaultValue={network.state ?? ""}
                      />
                      <TextInput
                        label="Service area"
                        name="serviceArea"
                        defaultValue={network.serviceArea ?? ""}
                      />
                      <TextInput
                        label="Author name"
                        name="authorName"
                        defaultValue={network.authorName ?? ""}
                      />
                      <TextInput
                        label="Author title"
                        name="authorTitle"
                        defaultValue={network.authorTitle ?? ""}
                      />
                      <TextInput
                        label="Author image URL"
                        name="authorImageUrl"
                        defaultValue={network.authorImageUrl ?? ""}
                      />
                      <TextInput
                        label="New site API key"
                        name="siteApiKey"
                        placeholder={
                          network.siteApiKeyHint
                            ? `Current key ends ${network.siteApiKeyHint}`
                            : "Optional"
                        }
                      />
                      <TextInput
                        label="Vercel revalidate URL"
                        name="revalidateUrl"
                        defaultValue={network.revalidateUrl ?? ""}
                      />
                      <TextInput
                        label="Vercel revalidate secret"
                        name="revalidateSecret"
                        placeholder={
                          network.revalidateSecret
                            ? "Leave blank to clear or rotate"
                            : "Optional"
                        }
                      />
                      <label className="block md:col-span-2">
                        <span className="text-sm font-medium text-slate-700">
                          Author bio
                        </span>
                        <textarea
                          name="authorBio"
                          rows={3}
                          defaultValue={network.authorBio ?? ""}
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                        />
                      </label>
                      <details className="md:col-span-2 rounded-2xl bg-white p-4">
                        <summary className="cursor-pointer font-semibold">
                          Legacy GHL settings
                        </summary>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <TextInput
                            label="New GHL API token"
                            name="apiToken"
                            placeholder="Leave blank to keep current token"
                          />
                          <TextInput
                            label="GHL blog ID"
                            name="blogId"
                            defaultValue={network.blogConfig?.blogId ?? ""}
                          />
                          <TextInput
                            label="GHL location ID"
                            name="ghlLocationId"
                            defaultValue={network.ghlLocationId ?? ""}
                          />
                          <TextInput
                            label="GHL company ID"
                            name="ghlCompanyId"
                            defaultValue={network.ghlCompanyId ?? ""}
                          />
                        </div>
                      </details>
                      <TextInput
                        label="Image style"
                        name="imageStyle"
                        defaultValue={network.blogConfig?.imageStyle ?? ""}
                      />
                      <label className="block md:col-span-2">
                        <span className="text-sm font-medium text-slate-700">
                          Default topic
                        </span>
                        <textarea
                          required
                          name="defaultTopic"
                          rows={3}
                          defaultValue={network.blogConfig?.defaultTopic ?? ""}
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                        />
                      </label>
                      <label className="block md:col-span-2">
                        <span className="text-sm font-medium text-slate-700">
                          Categories
                        </span>
                        <textarea
                          name="categories"
                          rows={2}
                          defaultValue={
                            network.blogConfig?.categories.join(", ") ?? ""
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                        />
                      </label>
                      <fieldset className="md:col-span-2">
                        <legend className="text-sm font-medium text-slate-700">
                          Posting days
                        </legend>
                        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                          {postingDays.map((day) => (
                            <label
                              key={day}
                              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                name="postingDays"
                                value={day}
                                defaultChecked={network.blogConfig?.postingDays.includes(
                                  day,
                                )}
                              />
                              {day}
                            </label>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Leave all unchecked to post every day.
                        </p>
                      </fieldset>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-sm font-medium text-slate-700">
                            Posting time
                          </span>
                          <input
                            type="time"
                            name="postingTime"
                            defaultValue={
                              network.blogConfig?.postingTime ?? "08:00"
                            }
                            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                          />
                        </label>
                        <label className="block">
                          <span className="text-sm font-medium text-slate-700">
                            Time zone
                          </span>
                          <select
                            name="timezone"
                            defaultValue={
                              network.blogConfig?.timezone ??
                              "America/New_York"
                            }
                            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                          >
                            {timezones.map((tz) => (
                              <option key={tz.value} value={tz.value}>
                                {tz.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <fieldset className="rounded-2xl bg-white p-4 md:col-span-2">
                        <legend className="text-sm font-semibold text-slate-800">
                          Automation
                        </legend>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <CheckboxInput
                            defaultChecked={
                              network.blogConfig?.automationEnabled ?? false
                            }
                            label="Enable automated generation"
                            name="automationEnabled"
                          />
                          <CheckboxInput
                            defaultChecked={
                              network.blogConfig?.autoPublishEnabled ?? false
                            }
                            label="Auto-publish generated drafts"
                            name="autoPublishEnabled"
                          />
                          <CheckboxInput
                            defaultChecked={
                              network.blogConfig?.autoImageEnabled ?? true
                            }
                            label="Auto-select Pexels image"
                            name="autoImageEnabled"
                          />
                        </div>
                        <p className="mt-3 text-sm text-slate-500">
                          The scheduler runs inside the Railway process every 5
                          minutes and fires at the configured posting time.
                        </p>
                      </fieldset>
                      <SubmitButton
                        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 md:col-span-2"
                        pendingText="Saving settings..."
                      >
                        Save site settings
                      </SubmitButton>
                    </form>
                  </details>

                  <details className="mt-6 rounded-2xl bg-slate-950 p-4 text-white">
                    <summary className="cursor-pointer font-semibold">
                      Site API setup
                    </summary>
                    <div className="mt-4 space-y-3 text-sm">
                      <p className="text-slate-300">
                        Add these values to the matching Vercel website.
                      </p>
                      <pre className="overflow-x-auto rounded-2xl bg-black/30 p-4 text-xs text-cyan-100">
{`TOWNCRIER_API_URL=${appUrl}
TOWNCRIER_SITE_SLUG=${network.slug}
TOWNCRIER_SITE_API_KEY=${network.siteApiKeyHint ? "<use the key you entered>" : "<optional for published posts>"}
TOWNCRIER_REVALIDATE_SECRET=${network.revalidateSecret ? "<configured>" : "<optional>"}`}
                      </pre>
                      <p className="break-all text-slate-300">
                        Posts API: {appUrl}/api/v1/sites/{network.slug}/posts
                      </p>
                    </div>
                  </details>

                  <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold">Topic bank</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Add recurring topics and Towncrier will rotate through
                          the least-used active topic.
                        </p>
                      </div>
                      <form action={generateNextTopicPostAction}>
                        <input
                          type="hidden"
                          name="networkId"
                          value={network.id}
                        />
                        <SubmitButton
                          className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                          pendingText="Generating..."
                        >
                          Generate from next topic
                        </SubmitButton>
                      </form>
                    </div>

                    <form
                      action={createTopicAction}
                      className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_110px_auto]"
                    >
                      <input
                        type="hidden"
                        name="networkId"
                        value={network.id}
                      />
                      <input
                        required
                        name="title"
                        className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                        placeholder="Topic title"
                      />
                      <input
                        name="category"
                        className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                        placeholder="Category"
                      />
                      <input
                        name="priority"
                        className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                        defaultValue="0"
                        type="number"
                      />
                      <SubmitButton
                        className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                        pendingText="Adding..."
                      >
                        Add topic
                      </SubmitButton>
                      <textarea
                        name="description"
                        rows={2}
                        className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2 md:col-span-4"
                        placeholder="Optional notes for Claude"
                      />
                    </form>

                    <div className="mt-4 space-y-2">
                      {network.topics.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">
                          No topics yet. Add 5-10 topics to rotate evenly
                          through the week.
                        </p>
                      ) : (
                        network.topics.map((topic) => (
                          <div
                            key={topic.id}
                            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-semibold">{topic.title}</p>
                              <p className="mt-1 text-sm text-slate-600">
                                {topic.category || "Uncategorized"} / used{" "}
                                {topic.useCount} time
                                {topic.useCount === 1 ? "" : "s"}
                                {topic.lastUsedAt
                                  ? ` / last used ${topic.lastUsedAt.toLocaleDateString()}`
                                  : ""}
                              </p>
                              {topic.description ? (
                                <p className="mt-1 text-sm text-slate-500">
                                  {topic.description}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <form action={toggleTopicAction}>
                                <input
                                  type="hidden"
                                  name="topicId"
                                  value={topic.id}
                                />
                                <SubmitButton
                                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                  pendingText="Updating..."
                                >
                                  {topic.isActive ? "Pause" : "Activate"}
                                </SubmitButton>
                              </form>
                              <form action={deleteTopicAction}>
                                <input
                                  type="hidden"
                                  name="topicId"
                                  value={topic.id}
                                />
                                <SubmitButton
                                  className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                                  pendingText="Deleting..."
                                >
                                  Delete
                                </SubmitButton>
                              </form>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <h3 className="font-semibold">Generate next blog</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Draft generation can take 20-60 seconds while Claude
                      writes the post. If Pexels is configured, Towncrier will
                      automatically attach a featured image.
                    </p>
                    <form
                      action={generatePostAction}
                      className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"
                    >
                      <input type="hidden" name="networkId" value={network.id} />
                      <input
                        name="topic"
                        className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                        placeholder={
                          network.blogConfig?.defaultTopic ??
                          "Topic for this blog"
                        }
                      />
                      <SubmitButton
                        className="rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
                        pendingText="Generating..."
                      >
                        Generate draft
                      </SubmitButton>
                    </form>
                  </div>

                  <details className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <summary className="cursor-pointer font-semibold">
                      Submit your own blog copy
                    </summary>
                    <p className="mt-2 text-sm text-slate-600">
                      If you leave Image URL blank, Towncrier will try to find a
                      Pexels image automatically.
                    </p>
                    <form
                      action={createManualPostAction}
                      className="mt-4 space-y-4"
                    >
                      <input
                        type="hidden"
                        name="networkId"
                        value={network.id}
                      />
                      <TextInput label="Title" name="title" required />
                      <TextInput label="URL slug" name="slug" />
                      <label className="block">
                        <span className="text-sm font-medium text-slate-700">
                          Excerpt
                        </span>
                        <textarea
                          required
                          name="excerpt"
                          rows={3}
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-slate-700">
                          Blog copy / markdown
                        </span>
                        <textarea
                          required
                          name="bodyMarkdown"
                          rows={12}
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                          placeholder="Paste your full blog copy here."
                        />
                      </label>
                      <div className="grid gap-4 md:grid-cols-2">
                        <TextInput
                          label="Categories"
                          name="categories"
                          placeholder="Back Pain, Wellness"
                        />
                        <TextInput label="Scheduled for" name="scheduledFor" />
                        <TextInput label="SEO title" name="seoTitle" />
                        <TextInput
                          label="SEO description"
                          name="seoDescription"
                        />
                        <TextInput label="Canonical URL" name="canonicalUrl" />
                        <TextInput label="Image URL" name="imageUrl" />
                        <TextInput
                          label="Featured image alt"
                          name="featuredImageAlt"
                        />
                      </div>
                      <label className="block">
                        <span className="text-sm font-medium text-slate-700">
                          Image prompt
                        </span>
                        <textarea
                          name="imagePrompt"
                          rows={3}
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                        />
                      </label>
                      <SubmitButton
                        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        pendingText="Saving manual draft..."
                      >
                        Save manual draft
                      </SubmitButton>
                    </form>
                  </details>

                  <div className="mt-6 space-y-4">
                    {network.posts.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">
                        No drafts yet for this network.
                      </p>
                    ) : (
                      network.posts.map((post) => (
                        <div
                          key={post.id}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            {post.status} / {post.source}
                            {post.scheduledFor
                              ? ` / scheduled ${post.scheduledFor.toLocaleDateString()}`
                              : ""}
                          </p>
                          <h3 className="mt-2 text-xl font-semibold">
                            {post.title}
                          </h3>
                          <p className="mt-2 text-sm text-slate-600">
                            {post.excerpt}
                          </p>

                          {post.imageUrl ? (
                            <div
                              aria-label={post.title}
                              className="mt-4 aspect-[16/9] w-full rounded-2xl bg-cover bg-center"
                              role="img"
                              style={{
                                backgroundImage: `url(${post.imageUrl})`,
                              }}
                            />
                          ) : null}

                          {post.imageCredit ? (
                            <p className="mt-2 text-xs text-slate-500">
                              {post.imageCredit}
                              {post.imageSourceUrl ? (
                                <>
                                  {" "}
                                  /{" "}
                                  <a
                                    className="underline"
                                    href={post.imageSourceUrl}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    source
                                  </a>
                                </>
                              ) : null}
                            </p>
                          ) : null}

                          {post.errorMessage ? (
                            <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                              {post.errorMessage}
                            </p>
                          ) : null}

                          {post.imagePrompt ? (
                            <p className="mt-3 text-sm text-slate-500">
                              Image prompt: {post.imagePrompt}
                            </p>
                          ) : null}

                          {post.status === "draft" ||
                          post.status === "failed" ? (
                            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <h4 className="font-semibold">
                                    Pexels images
                                  </h4>
                                  <p className="text-sm text-slate-600">
                                    Search uses the image prompt, topic, or
                                    title.
                                  </p>
                                </div>
                                <form action={findPexelsImagesAction}>
                                  <input
                                    type="hidden"
                                    name="postId"
                                    value={post.id}
                                  />
                                  <SubmitButton
                                    className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                                    pendingText="Searching..."
                                  >
                                    Find Pexels images
                                  </SubmitButton>
                                </form>
                              </div>

                              {post.imageCandidates.length > 0 ? (
                                <div className="mt-4 grid gap-3 md:grid-cols-3">
                                  {post.imageCandidates.map((candidate) => (
                                    <div
                                      key={candidate.id}
                                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                                    >
                                      <div
                                        aria-label={
                                          candidate.altText ?? post.title
                                        }
                                        className="aspect-[16/9] bg-cover bg-center"
                                        role="img"
                                        style={{
                                          backgroundImage: `url(${candidate.imageUrl})`,
                                        }}
                                      />
                                      <div className="space-y-2 p-3">
                                        <p className="text-xs text-slate-500">
                                          {candidate.photographer
                                            ? `Photo by ${candidate.photographer}`
                                            : "Pexels image"}
                                        </p>
                                        <form
                                          action={applyImageCandidateAction}
                                        >
                                          <input
                                            type="hidden"
                                            name="candidateId"
                                            value={candidate.id}
                                          />
                                          <SubmitButton
                                            className="w-full rounded-xl bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                                            pendingText="Applying..."
                                          >
                                            Use image
                                          </SubmitButton>
                                        </form>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {post.status === "draft" ||
                          post.status === "failed" ? (
                            <details className="mt-4 rounded-2xl bg-slate-50 p-4">
                              <summary className="cursor-pointer font-semibold">
                                Edit draft
                              </summary>
                              <form
                                action={updateDraftAction}
                                className="mt-4 space-y-4"
                              >
                                <input
                                  type="hidden"
                                  name="postId"
                                  value={post.id}
                                />
                                <TextInput
                                  label="Title"
                                  name="title"
                                  required
                                  defaultValue={post.title}
                                />
                                <TextInput
                                  label="URL slug"
                                  name="slug"
                                  required
                                  defaultValue={post.slug}
                                />
                                <label className="block">
                                  <span className="text-sm font-medium text-slate-700">
                                    Excerpt
                                  </span>
                                  <textarea
                                    required
                                    name="excerpt"
                                    rows={3}
                                    defaultValue={post.excerpt}
                                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-sm font-medium text-slate-700">
                                    Body markdown
                                  </span>
                                  <textarea
                                    required
                                    name="bodyMarkdown"
                                    rows={10}
                                    defaultValue={post.bodyMarkdown}
                                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                                  />
                                </label>
                                <TextInput
                                  label="Categories"
                                  name="categories"
                                  defaultValue={post.categories.join(", ")}
                                />
                                <TextInput
                                  label="SEO title"
                                  name="seoTitle"
                                  defaultValue={post.seoTitle ?? post.title}
                                />
                                <TextInput
                                  label="SEO description"
                                  name="seoDescription"
                                  defaultValue={
                                    post.seoDescription ?? post.excerpt
                                  }
                                />
                                <TextInput
                                  label="Canonical URL"
                                  name="canonicalUrl"
                                  defaultValue={post.canonicalUrl ?? ""}
                                />
                                <TextInput
                                  label="Image URL"
                                  name="imageUrl"
                                  defaultValue={post.imageUrl ?? ""}
                                  placeholder="https://example.com/image.jpg"
                                />
                                <TextInput
                                  label="Featured image alt"
                                  name="featuredImageAlt"
                                  defaultValue={
                                    post.featuredImageAlt ?? post.title
                                  }
                                />
                                <label className="block">
                                  <span className="text-sm font-medium text-slate-700">
                                    Image prompt
                                  </span>
                                  <textarea
                                    name="imagePrompt"
                                    rows={3}
                                    defaultValue={post.imagePrompt ?? ""}
                                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                                  />
                                </label>
                                <SubmitButton
                                  className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                                  pendingText="Saving draft..."
                                >
                                  Save draft
                                </SubmitButton>
                              </form>
                            </details>
                          ) : null}

                          <div className="mt-4 flex flex-wrap gap-3">
                            {post.status === "draft" ||
                            post.status === "failed" ? (
                              <form action={publishPostAction}>
                                <input
                                  type="hidden"
                                  name="postId"
                                  value={post.id}
                                />
                                <SubmitButton
                                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                                  pendingText="Publishing..."
                                >
                                  Publish
                                </SubmitButton>
                              </form>
                            ) : null}

                            {post.status === "published" &&
                            network.platform === "vercel" ? (
                              <form action={repushPostAction}>
                                <input
                                  type="hidden"
                                  name="postId"
                                  value={post.id}
                                />
                                <SubmitButton
                                  className="rounded-xl border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-50"
                                  pendingText="Pushing to site..."
                                >
                                  Re-push to site
                                </SubmitButton>
                              </form>
                            ) : null}

                            <form action={deletePostAction}>
                              <input
                                type="hidden"
                                name="postId"
                                value={post.id}
                              />
                              <SubmitButton
                                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                                pendingText="Deleting..."
                              >
                                Delete
                              </SubmitButton>
                            </form>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function TextInput({
  label,
  name,
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        required={required}
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
        placeholder={placeholder}
      />
    </label>
  );
}

function CheckboxInput({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
      <input
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300"
      />
      {label}
    </label>
  );
}
