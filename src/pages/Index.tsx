import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Index = () => {
  return (
    <main className="min-h-screen bg-gradient-primary">
      <section className="container mx-auto px-6 py-24 flex flex-col items-center text-center gap-8">
        <h1 className="text-5xl font-extrabold tracking-tight">ReliefNet — Disaster Help & Volunteer Map</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Connect victims with volunteers in real-time. Submit emergencies as red pins on OpenStreetMap and navigate to respond safely.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button size="lg" onClick={() => (window.location.href = "/map?role=victim")}>I need help</Button>
          <Button size="lg" variant="secondary" onClick={() => (window.location.href = "/map?role=volunteer")}>I want to help</Button>
        </div>
        <Card className="w-full max-w-4xl mt-6 shadow-glow">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Privacy-first demo. No signup yet; we’ll add secure auth and a shared backend next.
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default Index;
