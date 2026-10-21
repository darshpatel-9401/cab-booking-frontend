import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Log in | Cab Booking" };

export default function RiderLoginPage() {
  return <AuthForm portal="rider" mode="login" />;
}