import { useEffect, useRef } from "react";

export function InPostWidget({ onSelect }: { onSelect: (point: any) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let script: HTMLScriptElement;
    let link: HTMLLinkElement;

    if (!document.getElementById("inpost-script")) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://geowidget.inpost.pl/inpost-geowidget.css";
      document.head.appendChild(link);

      script = document.createElement("script");
      script.id = "inpost-script";
      script.src = "https://geowidget.inpost.pl/inpost-geowidget.js";
      script.async = true;
      document.body.appendChild(script);
    }

    const initMap = () => {
      // Wait for script to load
      if (!(window as any).easyPack) {
        setTimeout(initMap, 100);
        return;
      }
      
      (window as any).easyPack.init({});
      (window as any).easyPack.mapWidget("easypack-map", (point: any) => {
        onSelect(point);
      });
    };

    initMap();

    return () => {
      // cleanup if needed
    };
  }, [onSelect]);

  return <div id="easypack-map" ref={containerRef} style={{ width: "100%", height: "400px", marginTop: "1rem" }}></div>;
}
