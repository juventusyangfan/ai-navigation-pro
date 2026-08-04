import Link from "next/link";
import { Scene, Tool, roleClass } from "@/lib/content";
import { Icon } from "@/lib/icons";

export default function SceneCard({
  scene,
  rep,
  sopN,
}: {
  scene: Scene;
  rep: Tool[];
  sopN: number;
}) {
  return (
    <div className="scene-card" data-roles={scene.roles.join(",")}>
      <Link href={`/scenes/${scene.key}`} className="sc-main">
        <div className="ic">
          <Icon name={scene.icon} size={24} />
        </div>
        <h3>{scene.name}</h3>
        <div className="cnt">{rep.length} 个工具</div>
        <span className="arrow">
          <Icon name="ArrowRight" size={14} />
        </span>
      </Link>
      <div className="scene-roles">
        {scene.roles.map((r) => (
          <span key={r} className={`rb rb-${roleClass(r)}`}>
            {r}
          </span>
        ))}
      </div>
      {rep.length > 0 && (
        <div className="scene-rep">
          代表工具：
          {rep.map((t) => (
            <span key={t.slug} className="rt">
              {t.name}
            </span>
          ))}
        </div>
      )}
      {sopN > 0 && (
        <Link href={`/usages?scene=${scene.key}`} className="scene-sop-link">
          <Icon name="Notebook" size={14} className="inline" /> {sopN} 个用法 SOP{" "}
          <Icon name="ArrowRight" size={12} className="inline" />
        </Link>
      )}
    </div>
  );
}
