import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      richColors
      toastOptions={{ className: "!rounded-xl !font-sans !text-base" }}
      {...props}
    />
  );
}

export { Toaster };
