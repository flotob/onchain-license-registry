import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
    layout("routes/_layout.tsx", [
        index("routes/home.tsx"),
        route("admin", "routes/admin.tsx"),
        route("verify", "routes/verify.tsx"),
    ]),
    route("api/sign", "routes/api.sign.tsx"),
] satisfies RouteConfig;
