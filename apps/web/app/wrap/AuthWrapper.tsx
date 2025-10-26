import { SigninDialog } from "../components/SigninDialog";
import { useUserIdentity } from "../hooks/useUserIdentity";

export default function AuthWrapper({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId, userName } = useUserIdentity();

  return (
    <div>
      <div className="absolute bottom-4 right-4">
        <SigninDialog />
      </div>
      {children}
    </div>
  );
}
