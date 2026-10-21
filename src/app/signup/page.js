import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Sign up | Cab Booking" };

export default function RiderSignupPage() {
  return <AuthForm portal="rider" mode="signup" />;
}