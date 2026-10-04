import { Redirect } from "expo-router";

// The app opens on this week's menu (browsing needs no sign-in, as on the website).
export default function Index() {
  return <Redirect href="/menu" />;
}
