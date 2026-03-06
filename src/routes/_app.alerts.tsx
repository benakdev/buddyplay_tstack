import { Navigate, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/alerts')({
  component: AlertsRedirectPage
});
// TODO probaly we dont need this redirect and we can just delete this page.
function AlertsRedirectPage() {
  return <Navigate to="/my-games" replace />;
}
