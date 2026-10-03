import { AccountNav } from "@/components/account/account-nav";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import { requireUser } from "@/lib/security/auth";

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  await requireUser("/account");

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <AccountNav />
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
