import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { SignIn } from "@/app/(auth)/_components/sign-in";
import { getSafeRedirect } from "@/lib/auth-redirect";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {  
  const requestHeaders = await headers();
  const resolvedSearchParams = await searchParams;
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });
  const safeRedirect = getSafeRedirect(resolvedSearchParams.redirect);
  if (session?.user) {
    return redirect(safeRedirect === "/sign-in" ? "/projects" : safeRedirect);
  }

	return (
    <SignIn/>
  );
}
