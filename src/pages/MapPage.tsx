import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import L, { DivIcon, LatLngExpression } from "leaflet";
import "leaflet-routing-machine";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useSearchParams } from "react-router-dom";

// Types
type Role = "victim" | "volunteer";

interface HelpRequest {
  id: string;
  lat: number;
  lng: number;
  disasterType: string;
  resources: string[];
  description: string;
  victimName: string;
  victimPhone: string;
  createdAt: number;
}

// Local storage helpers
const STORAGE_KEY = "reliefnet-requests";
const loadRequests = (): HelpRequest[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HelpRequest[]) : [];
  } catch {
    return [];
  }
};
const saveRequests = (data: HelpRequest[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

const PROFILE_KEY = "reliefnet-profile";
type Profile = { name: string; phone: string };
const loadProfile = (): Profile => {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : { name: "", phone: "" };
  } catch {
    return { name: "", phone: "" };
  }
};
const saveProfile = (p: Profile) => localStorage.setItem(PROFILE_KEY, JSON.stringify(p));

// Red pin icon using SVG so we avoid external assets
function pinIcon(colorHsl: string): DivIcon {
  const svg = `
  <svg width="28" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="hsl(${colorHsl})" d="M12 2C7.59 2 4 5.59 4 10c0 5.25 7 12 8 12s8-6.75 8-12c0-4.41-3.59-8-8-8Zm0 10.5A2.5 2.5 0 1 1 12 7.5a2.5 2.5 0 0 1 0 5Z"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [28, 40],
    iconAnchor: [14, 36],
    popupAnchor: [0, -28],
  });
}

// Routing control
function RoutingControl({ from, to }: { from: LatLngExpression | null; to: LatLngExpression | null }) {
  const map = useMap();
  const controlRef = useRef<any>(null);

  useEffect(() => {
    if (!from || !to) {
      if (controlRef.current) {
        try { map.removeControl(controlRef.current); } catch {}
        controlRef.current = null;
      }
      return;
    }

    const ctrl = (L as any).Routing.control({
      waypoints: [L.latLng(from as any), L.latLng(to as any)],
      router: (L as any).Routing.osrmv1({ serviceUrl: "https://router.project-osrm.org/route/v1" }),
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      lineOptions: {
        styles: [
          { color: `hsl(var(--accent-strong))`, opacity: 0.9, weight: 6 },
          { color: `hsl(var(--background))`, opacity: 0.9, weight: 2 },
        ],
      },
      show: false,
      collapsible: true,
    }) as any;

    controlRef.current = ctrl;
    ctrl.addTo(map);

    return () => {
      try { map.removeControl(ctrl); } catch {}
      controlRef.current = null;
    };
  }, [from, to, map]);

  return null;
}

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const initialRole = (params.get("role") as Role) || "victim";
  const [role, setRole] = useState<Role>(initialRole);

  const [myLocation, setMyLocation] = useState<LatLngExpression | null>(null);
  const [requests, setRequests] = useState<HelpRequest[]>(() => loadRequests());

  // Form state
  const [disasterType, setDisasterType] = useState<string>("earthquake");
  const [resources, setResources] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // User details
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");

  useEffect(() => {
    const p = loadProfile();
    setName(p.name);
    setPhone(p.phone);
  }, []);

  useEffect(() => {
    saveProfile({ name, phone });
  }, [name, phone]);

  // Routing target
  const [routeTo, setRouteTo] = useState<LatLngExpression | null>(null);

  useEffect(() => {
    // Update URL param when role changes
    const search = new URLSearchParams(params);
    search.set("role", role);
    setParams(search, { replace: true });
  }, [role]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setMyLocation([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        // silently ignore
      }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  useEffect(() => saveRequests(requests), [requests]);

  const submitRequest = () => {
    if (!myLocation) {
      toast({ title: "Location unavailable", description: "Enable location services to submit a request." });
      return;
    }
    if (!name || !phone) {
      toast({ title: "Your details required", description: "Please enter your name and phone number." });
      return;
    }
    const [lat, lng] = myLocation as [number, number];
    const newReq: HelpRequest = {
      id: `${Date.now()}`,
      lat,
      lng,
      disasterType,
      resources: resources.split(",").map((r) => r.trim()).filter(Boolean),
      description,
      victimName: name,
      victimPhone: phone,
      createdAt: Date.now(),
    };
    setRequests((prev) => [newReq, ...prev]);
    toast({ title: "Request submitted", description: "Your emergency is now visible as a red pin." });
    setResources("");
    setDescription("");
  };

  const redIcon = useMemo(() => pinIcon("var(--destructive)"), []);
  const meIcon = useMemo(() => pinIcon("var(--accent-strong)"), []);

  return (
    <div className="min-h-screen w-full flex flex-col">
      <header className="border-b bg-gradient-subtle">
        <div className="container mx-auto py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">ReliefNet</h1>
          <div className="flex items-center gap-2">
            <Label className="sr-only" htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(v: Role) => setRole(v)}>
              <SelectTrigger id="role" className="w-40">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="victim">Victim</SelectItem>
                <SelectItem value="volunteer">Volunteer</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={() => window.location.href = "/"}>Home</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr]">
        {/* Sidebar */}
        <aside className="border-r bg-card">
          <div className="h-full overflow-auto p-4 space-y-4">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle>{role === "victim" ? "Submit Emergency" : "Find Requests"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-1 block">Your Location</Label>
                  <div className="text-sm text-muted-foreground">
                    {myLocation ? (
                      <>Lat {(myLocation as any)[0].toFixed(5)}, Lng {(myLocation as any)[1].toFixed(5)}</>
                    ) : (
                      <>Locating… allow browser location</>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <Label>Your Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone Number</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                  </div>
                </div>

                {role === "victim" ? (
                  <>
                    <div className="space-y-2">
                      <Label>Disaster Type</Label>
                      <Select value={disasterType} onValueChange={setDisasterType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select disaster" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="earthquake">Earthquake</SelectItem>
                          <SelectItem value="flood">Flood</SelectItem>
                          <SelectItem value="fire">Fire</SelectItem>
                          <SelectItem value="cyclone">Cyclone</SelectItem>
                          <SelectItem value="landslide">Landslide</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Resources Needed (comma separated)</Label>
                      <Input value={resources} onChange={(e) => setResources(e.target.value)} placeholder="water, food, shelter" />
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your situation…" rows={4} />
                    </div>

                    <Button className="w-full" onClick={submitRequest} disabled={!myLocation}>Submit Request</Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <Label>Active Requests</Label>
                    <div className="space-y-3 max-h-[40vh] overflow-auto pr-1">
                      {requests.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No requests yet.</div>
                      ) : (
                        requests.map((r) => (
                          <Card key={r.id} className="">
                            <CardContent className="py-3">
                              <div className="text-sm font-medium capitalize">{r.disasterType}</div>
                              <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div>
                              <div className="text-xs text-muted-foreground">Victim: {r.victimName} • {r.victimPhone}</div>
                              {r.resources.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {r.resources.map((res, i) => (
                                    <Badge key={i} variant="secondary">{res}</Badge>
                                  ))}
                                </div>
                              )}
                              {r.description && <div className="mt-2 text-sm">{r.description}</div>}
                              <div className="mt-2">
                                <Button size="sm" onClick={() => setRouteTo([r.lat, r.lng])} disabled={!myLocation || !name || !phone}>Respond</Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            <div className="text-xs text-muted-foreground">
              Routes powered by OSRM demo; map © OpenStreetMap contributors.
            </div>
          </div>
        </aside>

        {/* Map */}
        <section className="relative">
          <MapContainer
            className="absolute inset-0"
            center={myLocation ? (myLocation as any) : ([20, 0] as any)}
            zoom={myLocation ? 13 : 2}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* My location marker */}
            {myLocation && (
              <Marker position={myLocation as any} icon={meIcon}>
                <Popup>You are here</Popup>
              </Marker>
            )}

            {/* Requests markers */}
            {requests.map((r) => (
              <Marker key={r.id} position={[r.lat, r.lng]} icon={redIcon}>
                <Popup>
                  <div className="space-y-1">
                    <div className="font-medium capitalize">{r.disasterType}</div>
                    <div className="text-xs text-muted-foreground">Victim: {r.victimName} • {r.victimPhone}</div>
                    {r.resources.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {r.resources.map((res, i) => (
                          <Badge key={i} variant="secondary">{res}</Badge>
                        ))}
                      </div>
                    )}
                    {r.description && <div className="text-sm">{r.description}</div>}
                    {role === "volunteer" && (
                      <Button size="sm" className="mt-2" onClick={() => setRouteTo([r.lat, r.lng])} disabled={!myLocation || !name || !phone}>
                        Respond
                      </Button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            <RoutingControl from={myLocation} to={routeTo} />
          </MapContainer>
        </section>
      </main>
    </div>
  );
}
