import type { LitLessonDetail } from "@/lib/content";

// 伴学页结构化数据（AISO 核心）：页面本体是本站 LearningResource，
// 官方课程是其 isBasedOn 的外部 Course。FAQPage 仅在 faq.length > 0 时输出。
export default function LessonJsonLd({
  lesson,
  base = "https://eanavi.com",
}: {
  lesson: LitLessonDetail;
  base?: string;
}) {
  const url = `${base}/literacy/${lesson.moduleSlug}/${lesson.slug}`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "LearningResource",
      "@id": `${url}#resource`,
      name: `${lesson.title} · 教师伴学导读`,
      description: lesson.hook,
      learningResourceType: "导学指南",
      educationalLevel: lesson.stage ?? "通用",
      audience: { "@type": "EducationalAudience", educationalRole: "teacher" },
      inLanguage: "zh-CN",
      datePublished: lesson.publishedAt,
      dateModified: lesson.updatedAt,
      publisher: { "@type": "Organization", name: "智用笔记", url: base },
      isBasedOn: lesson.officialUrl
        ? {
            "@type": "Course",
            name: lesson.title,
            url: lesson.officialUrl,
            provider: {
              "@type": "Organization",
              name: lesson.officialProvider ?? "国家中小学智慧教育平台",
            },
          }
        : undefined,
      teaches: lesson.watchPoints,
      hasPart: lesson.sops.map((s) => ({
        "@type": "HowTo",
        name: s.title,
        url: `${base}/usages/${s.id}`,
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "AI通识课", item: `${base}/literacy` },
        {
          "@type": "ListItem",
          position: 2,
          name: lesson.moduleTitle,
          item: `${base}/literacy/${lesson.moduleSlug}`,
        },
        { "@type": "ListItem", position: 3, name: lesson.title },
      ],
    },
  ];

  if (lesson.faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: lesson.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) }}
    />
  );
}
