import { Home, RefreshCw } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { Button } from "@/components/ui/button";
import { ScreenState } from "@/components/shared/ScreenState";

export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (!notFound) console.error(error);
  return (
    <ScreenState
      tone={notFound ? "default" : "error"}
      title={notFound ? "Page not found" : "Something broke"}
      message={notFound ? "That link doesn't lead anywhere. Let's get you back to the party." : "An unexpected error happened. Try reloading the page."}
      action={
        <>
          <Button asChild size="lg">
            <Link to="/">
              <Home /> Home
            </Link>
          </Button>
          {!notFound && (
            <Button size="lg" variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw /> Reload
            </Button>
          )}
        </>
      }
    />
  );
}
