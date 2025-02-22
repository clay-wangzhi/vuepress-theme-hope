import { usePageData, useSiteData } from "@vuepress/client";
import { type VNode, computed, defineComponent, h } from "vue";
import { type RouteMeta, RouterLink, useRouter } from "vue-router";
import {
  endsWith,
  keys,
  startsWith,
  useLocaleConfig,
} from "vuepress-shared/client";

import { type AutoCatalogLocaleConfig } from "../../shared/index.js";

import "../styles/auto-catalog.scss";

declare const AUTO_CATALOG_LOCALES: AutoCatalogLocaleConfig;
declare const AUTO_CATALOG_TITLE_META_KEY: string;
declare const AUTO_CATALOG_ICON_META_KEY: string;
declare const AUTO_CATALOG_ORDER_META_KEY: string;
declare const AUTO_CATALOG_INDEX_META_KEY: string;

export interface AutoCatalogProps {
  base?: string;
  level?: 1 | 2 | 3;
}

interface CatalogInfo {
  title: string;
  icon: string | null | undefined;
  base: string;
  order: number | null | undefined;
  level: number;
  path: string;
  children?: CatalogInfo[];
}

export default defineComponent({
  name: "AutoCatalog",

  props: {
    /**
     * Catalog Base
     *
     * 目录的基础路径
     *
     * @default current route base
     */
    base: {
      type: String,
      default: "",
    },

    /**
     * Max level of catalog
     *
     * @description only 1,2,3 are supported
     *
     * Catalog 的最大层级
     *
     * @description 目前仅支持 1,2,3
     *
     * @default 3
     */
    level: {
      type: Number,
      default: 3,
    },

    /**
     * Whether show index for catalog
     *
     * 目录是否显示索引
     */
    index: Boolean,
  },

  setup(props, { slots }) {
    const locale = useLocaleConfig(AUTO_CATALOG_LOCALES);
    const page = usePageData();
    const router = useRouter();
    const siteData = useSiteData();

    const shouldIndex = (meta: RouteMeta): boolean => {
      const index = <boolean | undefined>meta[AUTO_CATALOG_INDEX_META_KEY];

      return typeof index === "undefined" || index;
    };

    const getCatalogInfo = (): CatalogInfo[] => {
      const base = props.base || page.value.path.replace(/\/[^/]+$/, "/");
      const routes = router.getRoutes();
      const result: CatalogInfo[] = [];

      routes
        .filter(({ meta, path }) => {
          // filter those under current base
          if (!startsWith(path, base) || path === base) return false;

          if (base === "/") {
            const otherLocales = keys(siteData.value.locales).filter(
              (item) => item !== "/"
            );

            // exclude 404 page and other locales
            if (
              path === "/404.html" ||
              otherLocales.some((localePath) => startsWith(path, localePath))
            )
              return false;
          }

          return (
            // filter real page
            ((endsWith(path, ".html") && !endsWith(path, "/index.html")) ||
              endsWith(path, "/")) &&
            // page should be indexed
            shouldIndex(meta)
          );
        })
        .map(({ path, meta }) => {
          const level = path.substring(base.length).split("/").length;

          return {
            title: <string>meta[AUTO_CATALOG_TITLE_META_KEY] || "",
            icon: <string | null | undefined>meta[AUTO_CATALOG_ICON_META_KEY],
            base: path.replace(/\/[^/]+\/?$/, "/"),
            order:
              <number | null | undefined>meta[AUTO_CATALOG_ORDER_META_KEY] ||
              null,
            level: endsWith(path, "/") ? level - 1 : level,
            path,
          };
        })
        .filter(
          ({ title, level }) =>
            typeof title === "string" && title && level <= props.level
        )
        .sort(
          (
            { title: titleA, level: levelA, path: pathA, order: orderA },
            { title: titleB, level: levelB, path: pathB, order: orderB }
          ) => {
            const level = levelA - levelB;

            if (level) return level;

            // check README.md, it should be first one
            if (endsWith(pathA, "/index.html")) return -1;
            if (endsWith(pathB, "/index.html")) return 1;

            // infoA order is absent
            if (orderA === null) {
              // infoB order is absent
              if (orderB === null)
                // compare title
                return titleA.localeCompare(titleB);

              // infoB order is present
              return orderB;
            }

            // infoB order is absent
            if (orderB === null) return orderA;

            // now we are sure both order exist

            // infoA order is positive
            if (orderA > 0) {
              if (orderB > 0) return orderA - orderB;

              return -1;
            }

            // both order are negative
            if (orderB < 0) return orderA - orderB;

            return 1;
          }
        )
        .forEach((info) => {
          const { base, level } = info;

          switch (level) {
            case 1:
              result.push(info);
              break;

            case 2: {
              const parent = result.find((item) => item.path === base);

              if (parent) (parent.children ??= []).push(info);
              break;
            }

            default: {
              const grandParent = result.find(
                (item) => item.path === base.replace(/\/[^/]+\/$/, "/")
              );

              if (grandParent) {
                const parent = grandParent.children?.find(
                  (item) => item.path === base
                );

                if (parent) (parent.children ??= []).push(info);
              }
            }
          }
        });

      return result;
    };

    const info = computed(() => getCatalogInfo());

    return (): VNode =>
      h("div", { class: "auto-catalog-wrapper" }, [
        h("h2", { class: "main-title" }, locale.value.title),

        info.value.map(({ children = [], icon, path, title }, mainIndex) => [
          h(
            "h3",
            {
              id: title,
              class: ["child-title", { "has-children": children.length }],
            },
            [
              h("a", { href: `#${title}`, class: "header-anchor" }, "#"),
              h(RouterLink, { class: "catalog-title", to: path }, () => [
                props.index ? `${mainIndex + 1}.` : null,
                icon && slots["icon"] ? slots["icon"]({ icon }) : null,
                title || "Unknown",
              ]),
            ]
          ),
          children.length
            ? h(
                "ul",
                { class: "child-catalog-wrapper" },
                children.map(({ children = [], icon, path, title }, index) =>
                  h("li", { class: "child-catalog-item" }, [
                    h(
                      "div",
                      {
                        class: [
                          "sub-title",
                          { "has-children": children.length },
                        ],
                      },
                      [
                        h(
                          "a",
                          { href: `#${title}`, class: "header-anchor" },
                          "#"
                        ),
                        h(
                          RouterLink,
                          { class: "catalog-title", to: path },
                          () => [
                            props.index
                              ? `${mainIndex + 1}.${index + 1}`
                              : null,
                            icon && slots["icon"]
                              ? slots["icon"]({ icon })
                              : null,
                            title || "Unknown",
                          ]
                        ),
                      ]
                    ),
                    children.length
                      ? h(
                          "div",
                          { class: "sub-catalog-wrapper" },
                          children.map(({ icon, path, title }, subIndex) =>
                            h(
                              RouterLink,
                              {
                                class: "sub-catalog-item",
                                to: path,
                              },
                              () => [
                                props.index
                                  ? `${mainIndex + 1}.${index + 1}.${
                                      subIndex + 1
                                    }`
                                  : null,
                                icon && slots["icon"]
                                  ? slots["icon"]({ icon })
                                  : null,
                                title || "Unknown",
                              ]
                            )
                          )
                        )
                      : null,
                  ])
                )
              )
            : null,
        ]),
      ]);
  },
});
