import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Driver sign up | Cab Booking" };

export default function DriverSignupPage() {
  return <AuthForm portal="driver" mode="signup" />;
}