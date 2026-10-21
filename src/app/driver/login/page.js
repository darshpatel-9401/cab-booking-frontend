import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Driver login | Cab Booking" };

export default function DriverLoginPage() {
  return <AuthForm portal="driver" mode="login" />;
}