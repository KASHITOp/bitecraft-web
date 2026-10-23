"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { PageTitle, Section, Segmented } from "@/components/ui";
import { AreaPicker } from "@/components/AreaPicker";
import { TIER_LABEL } from "@/lib/data";
import { useTargets } from "@/lib/hooks";
import { ACTIVITY, ALL_GEAR, GOAL_LABEL } from "@/lib/profile";
import { useChefRecipes, useProfile, useSaved, useSettings, useShopping, type ThemePref } from "@/lib/state";
import { clearAll } from "@/lib/storage";

export function More() {
  const router = useRouter();
  const [profile] = useProfile();
  const t = useTargets();
  const [settings, setSettings] = useSettings();
  const [saved] = useSaved();
  const [mine] = useChefRecipes();
  const [list] = useShopping();
  const openItems = list.filter((i) => !i.done).length;

  return (
    <div className="pb-6">
      <PageTitle>More</PageTitle>

      <nav aria-label="More pages" className="px-4">
        <ul className="divide-y divide-rule rounded-md border border-rule bg-surface">
          <MoreLink href="/saved" icon="bookmark" label="Saved recipes" count={saved.length + mine.length} />
          <MoreLink href="/shopping" icon="list" label="Shopping list" count={openItems} />
          <MoreLink href="/mart" icon="store" label="Quick Mart price check" />
        </ul>
      </nav>

      <Section
        label="My targets"
        action={
          <Link href="/onboarding?edit=1" className="tap inline-flex items-center text-sm font-semibold underline underline-offset-4">
            Edit
          </Link>
        }
      >
        {profile && t ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Daily calories</dt>
            <dd className="num font-semibold">{t.kcal} kcal</dd>
            <dt className="text-muted">Daily protein</dt>
            <dd className="num font-semibold">{t.protein} g</dd>
            <dt className="text-muted">Goal</dt>
            <dd className="font-semibold">{GOAL_LABEL[profile.goal]}</dd>
            <dt className="text-muted">Budget</dt>
            <dd className="font-semibold">{TIER_LABEL[profile.tier]}</dd>
            <dt className="text-muted">Activity</dt>
            <dd className="font-semibold">{ACTIVITY[profile.activity].label}</dd>
            <dt className="text-muted">Kitchen</dt>
            <dd className="font-semibold">
              {profile.gear.length ? ALL_GEAR.filter((g) => profile.gear.includes(g.id)).map((g) => g.label).join(", ") : "Nothing yet"}
            </dd>
          </dl>
        ) : (
          <p>
            No targets yet.{" "}
            <Link href="/onboarding?edit=1" className="font-semibold underline underline-offset-4">
              Set them up
            </Link>{" "}
            in a minute.
          </p>
        )}
      </Section>

      <Section label="Your area">
        <div id="area">
          <AreaPicker />
        </div>
      </Section>

      <Section label="Theme">
        <Segmented<ThemePref>
          name="theme"
          label="Theme"
          value={settings.theme}
          onChange={(theme) => setSettings({ ...settings, theme })}
          options={[
            { value: "system", label: "Match phone" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Section>

      <Section label="Your data">
        <p className="text-sm text-muted">
          Everything lives on this phone only. No account, no server. Clearing your browser data wipes it.
        </p>
        <button
          type="button"
          className="btn mt-3 w-full border-chilli text-chilli"
          onClick={() => {
            if (window.confirm("Delete your targets, pantry, saved recipes, plan and shopping list from this phone?")) {
              clearAll();
              router.replace("/onboarding");
            }
          }}
        >
          <Icon name="trash" size={20} />
          Reset everything
        </button>
      </Section>

      <p className="px-4 pt-4 text-xs text-muted">
        Quick Mart shows live prices via QuickCommerce API when you tap Check live prices; otherwise sample prices from Oct 2026. Nutrition values are estimates.
      </p>
    </div>
  );
}

function MoreLink({ href, icon, label, count }: { href: string; icon: IconName; label: string; count?: number }) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 px-4 font-semibold">
        <Icon name={icon} size={22} />
        <span className="flex-1">{label}</span>
        {!!count && <span className="num rounded-full bg-accent px-2 py-0.5 text-xs text-accent-ink">{count}</span>}
        <Icon name="forward" size={18} className="text-muted" />
      </Link>
    </li>
  );
}
