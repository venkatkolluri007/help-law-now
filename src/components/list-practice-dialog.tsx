import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Props = {
  specialties: string[];
  trigger: React.ReactNode;
  onSubmitted?: () => void;
};

export function ListPracticeDialog({ specialties, trigger, onSubmitted }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    title: "",
    specialty: "",
    location: "",
    description: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);

  const reset = () => {
    setForm({ full_name: "", title: "", specialty: "", location: "", description: "" });
    setPhoto(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo) {
      toast.error("Please upload a photo.");
      return;
    }
    if (!form.specialty) {
      toast.error("Please choose a specialty.");
      return;
    }
    setSubmitting(true);
    try {
      const ext = photo.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("attorney-photos")
        .upload(path, photo, { contentType: photo.type, upsert: false });
      if (upErr) throw upErr;

      // Long-lived signed URL (10 years) since the bucket is private
      const { data: signed, error: signErr } = await supabase.storage
        .from("attorney-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed) throw signErr ?? new Error("Failed to sign URL");

      const { error: insErr } = await supabase
        .from("attorney_submissions")
        .insert({
          full_name: form.full_name.trim(),
          title: form.title.trim(),
          specialty: form.specialty,
          location: form.location.trim(),
          description: form.description.trim(),
          photo_url: signed.signedUrl,
          status: "pending",
        });
      if (insErr) throw insErr;

      toast.success("Submitted! Your listing will show as Pending review.");
      reset();
      setOpen(false);
      onSubmitted?.();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>List your practice</DialogTitle>
          <DialogDescription>
            Submit your details to appear in the directory. New listings show as “Pending review” until verified.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" required maxLength={100} value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" required maxLength={120} placeholder="e.g. Family Law Attorney"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Specialty</Label>
            <Select value={form.specialty} onValueChange={(v) => setForm({ ...form, specialty: v })}>
              <SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger>
              <SelectContent>
                {specialties.filter((s) => s !== "All").map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" required maxLength={120} placeholder="City, State"
              value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Short description</Label>
            <Textarea id="description" required maxLength={400} rows={3}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="photo">Profile photo</Label>
            <Input id="photo" type="file" accept="image/*" required
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Submit listing
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
