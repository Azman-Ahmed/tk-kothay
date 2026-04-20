import { useState } from "react";
import { MessageSquare, X, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { useAppContext } from "../../context/AppContext";

export function FeedbackModal({ isOpen, onClose }) {
  const { user } = useAppContext();
  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [formData, setFormData] = useState({
    type: "Idea",
    message: "",
    email: user?.email || "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");

    const accessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || "YOUR_ACCESS_KEY_HERE";

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: accessKey,
          from_name: "MoneyMate User Feedback",
          subject: `[${formData.type}] Feedback from ${formData.email}`,
          ...formData,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setStatus("success");
        setFormData({ type: "Idea", message: "", email: user?.email || "" });
        setTimeout(() => {
          onClose();
          setStatus("idle");
        }, 3000);
      } else {
        setStatus("error");
      }
    } catch (error) {
      console.error("Feedback submission error:", error);
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex h-12 items-center justify-between border-b px-4 bg-muted/30">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <MessageSquare className="h-4 w-4" />
            <span>Send Feedback</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {status === "success" ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold">Thank You!</h3>
              <p className="text-sm text-muted-foreground">Your feedback has been sent. I'll review it soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Feedback Type</label>
                <div className="flex flex-wrap gap-2">
                  {["Idea", "UI Bug", "Feature", "Other"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, type })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                        formData.type === type
                          ? "bg-primary border-primary text-primary-foreground shadow-sm"
                          : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Your Email (Optional)</label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-9 px-3"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Message</label>
                <textarea
                  required
                  placeholder="How can I improve MoneyMate?"
                  className="flex min-h-[120px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-shadow resize-none"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>

              {status === "error" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-100 dark:border-rose-900/30 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Something went wrong. Please try again.</span>
                </div>
              )}

              <Button type="submit" disabled={status === "loading" || !formData.message} className="w-full gap-2">
                {status === "loading" ? "Sending..." : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Send Message</span>
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
