import { n as __toESM } from "./rolldown-runtime-CO0Nlsmt.js";
import { l as require_react, s as useNavigate } from "./router-pSdmx2tz.js";
import { i as ArrowDown, n as MonitorPlay, r as ArrowUp, t as Plus } from "./plus-CpXDr5by.js";
import { $ as Radio, B as cachedGetDocs, F as ActionIconButton, I as require_jsx_runtime, M as useDialog, R as getFirebaseState, T as normalizeResultData, V as invalidateCache, X as Send, at as ExternalLink, ct as createLucideIcon, i as signOutStaff, n as resolveAuthenticatedProfile, r as routeForRole, t as ADMIN_ROLES, z as cachedGetDoc } from "./index-CSlXJ5_1.js";
import { t as Save } from "./save-PCeAK9Z_.js";
import { t as Trash } from "./trash-CCZobr2w.js";
import { E as collection, O as doc, S as setDoc, b as query, s as onAuthStateChanged, w as where } from "./firebase-DdS2SgEa.js";
import { t as WorkspaceShell } from "./WorkspaceShell-DgWJk69j.js";
// node_modules/lucide-react/dist/esm/icons/list-ordered.mjs
/**
* @license lucide-react v1.78.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var __iconData$1 = {
	name: "list-ordered",
	size: 24,
	node: [
		["path", {
			d: "M11 5h10",
			key: "1cz7ny"
		}],
		["path", {
			d: "M11 12h10",
			key: "1438ji"
		}],
		["path", {
			d: "M11 19h10",
			key: "11t30w"
		}],
		["path", {
			d: "M4 4h1v5",
			key: "10yrso"
		}],
		["path", {
			d: "M4 9h2",
			key: "r1h2o0"
		}],
		["path", {
			d: "M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02",
			key: "xtkcd5"
		}]
	]
};
__iconData$1.node;
var ListOrdered = createLucideIcon(__iconData$1);
// node_modules/lucide-react/dist/esm/icons/palette.mjs
/**
* @license lucide-react v1.78.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var __iconData = {
	name: "palette",
	size: 24,
	node: [
		["path", {
			d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",
			key: "e79jfc"
		}],
		["circle", {
			cx: "13.5",
			cy: "6.5",
			r: ".5",
			fill: "currentColor",
			key: "1okk4w"
		}],
		["circle", {
			cx: "17.5",
			cy: "10.5",
			r: ".5",
			fill: "currentColor",
			key: "f64h9f"
		}],
		["circle", {
			cx: "6.5",
			cy: "12.5",
			r: ".5",
			fill: "currentColor",
			key: "qy21gx"
		}],
		["circle", {
			cx: "8.5",
			cy: "7.5",
			r: ".5",
			fill: "currentColor",
			key: "fotxhn"
		}]
	]
};
__iconData.node;
var Palette = createLucideIcon(__iconData);
// src/pages/staff/TvControlPage.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var TvControlPage = () => {
	const navigate = useNavigate();
	const { toast } = useDialog();
	const [checkingAuth, setCheckingAuth] = (0, import_react.useState)(true);
	const [profile, setProfile] = (0, import_react.useState)(null);
	const [activeTab, setActiveTab] = (0, import_react.useState)("broadcast");
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [results, setResults] = (0, import_react.useState)([]);
	const [config, setConfig] = (0, import_react.useState)({
		title: "",
		subtitle: "",
		badgeText: "LIVE",
		tickerText: "",
		rotationSec: 12,
		mode: "dashboard",
		mediaMode: "dashboard",
		animationStyle: "spotlight",
		resultOrder: "latest",
		interruptPolicy: "finish-cycle",
		afterQueue: "loop",
		selectedResultIds: [],
		announcements: [],
		sections: { standings: true },
		show: {
			results: true,
			leaderboard: true
		},
		background: {
			color: "#020617",
			imageUrl: ""
		},
		mediaUrl: "",
		mediaCaption: ""
	});
	const loadTvData = (0, import_react.useCallback)(async (forceRefresh = false) => {
		const { db } = getFirebaseState();
		if (!db) return;
		if (forceRefresh) invalidateCache();
		try {
			const [tvCfg, tvLive, pubResults] = await Promise.all([
				cachedGetDoc(db, "settings", "tv_config", { forceRefresh }),
				cachedGetDoc(db, "settings", "tv_control", { forceRefresh }),
				cachedGetDocs("results:published", query(collection(db, "results"), where("status", "==", "published")), { forceRefresh })
			]);
			const merged = {
				...tvCfg,
				...tvLive
			};
			setConfig((prev) => ({
				...prev,
				...merged,
				selectedResultIds: merged.selectedResultIds || merged.resultQueue || [],
				tickerText: merged.ticker || merged.tickerText || "",
				mode: merged.mode || merged.mediaMode || "dashboard",
				mediaMode: merged.mediaMode || merged.mode || "dashboard",
				mediaUrl: merged.mediaUrl || merged.videoUrl || merged.videoUrls?.[0] || merged.imageUrls?.[0] || "",
				announcements: Array.isArray(merged.announcements) ? merged.announcements : []
			}));
			setResults(pubResults.map((r) => normalizeResultData(r)).sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0)));
		} catch (err) {
			toast(err?.message || "Unable to load TV settings.", "error");
		}
	}, [toast]);
	(0, import_react.useEffect)(() => {
		document.title = "TV Display Control — Feastport";
		const { auth, isFirebaseConfigured } = getFirebaseState();
		if (!isFirebaseConfigured || !auth) {
			setCheckingAuth(false);
			navigate("/login", { replace: true });
			return;
		}
		const unsub = onAuthStateChanged(auth, async (user) => {
			if (!user || user.isAnonymous) {
				setCheckingAuth(false);
				navigate("/login", { replace: true });
				return;
			}
			const p = await resolveAuthenticatedProfile(user.uid, user.email);
			if (!p) {
				navigate("/login", { replace: true });
				return;
			}
			if (!ADMIN_ROLES.has(p.role)) {
				navigate(routeForRole(p.role), { replace: true });
				return;
			}
			setProfile(p);
			setCheckingAuth(false);
			loadTvData();
		});
		return () => unsub();
	}, [navigate, loadTvData]);
	const queueIds = config.selectedResultIds || [];
	const toggleResultInQueue = (eventId) => {
		setConfig((prev) => {
			const list = prev.selectedResultIds || [];
			const next = list.includes(eventId) ? list.filter((id) => id !== eventId) : [...list, eventId];
			return {
				...prev,
				selectedResultIds: next,
				resultQueue: next
			};
		});
	};
	const moveQueueItem = (idx, dir) => {
		const next = [...queueIds];
		const target = idx + dir;
		if (target < 0 || target >= next.length) return;
		[next[idx], next[target]] = [next[target], next[idx]];
		setConfig((prev) => ({
			...prev,
			selectedResultIds: next,
			resultQueue: next
		}));
	};
	const persistTv = async (target) => {
		const { db } = getFirebaseState();
		if (!db) return;
		setSaving(true);
		try {
			const now = Date.now();
			const modeValue = config.mode || config.mediaMode || "dashboard";
			const controlPayload = {
				mode: modeValue,
				mediaMode: modeValue,
				animationStyle: config.animationStyle || "spotlight",
				resultOrder: config.resultOrder || "latest",
				interruptPolicy: config.interruptPolicy || "finish-cycle",
				afterQueue: config.afterQueue || "loop",
				selectedResultIds: queueIds,
				resultQueue: queueIds,
				mediaUrl: config.mediaUrl || "",
				videoUrl: modeValue === "video" ? config.mediaUrl || "" : "",
				videoUrls: modeValue === "video" && config.mediaUrl ? [config.mediaUrl] : [],
				imageUrls: modeValue === "image" && config.mediaUrl ? [config.mediaUrl] : [],
				mediaCaption: config.mediaCaption || "",
				rotationSec: Math.max(5, Number(config.rotationSec || 12)),
				updatedAt: now
			};
			const cfgPayload = {
				title: config.title || "",
				subtitle: config.subtitle || "",
				badgeText: config.badgeText || "LIVE",
				ticker: config.tickerText || "",
				tickerText: config.tickerText || "",
				announcements: (config.announcements || []).filter(Boolean),
				sections: { standings: config.show?.leaderboard !== false },
				show: {
					results: config.show?.results !== false,
					leaderboard: config.show?.leaderboard !== false
				},
				background: config.background || {
					color: "#020617",
					imageUrl: ""
				},
				updatedAt: now
			};
			if (target === "draft") {
				await setDoc(doc(db, "settings", "tv_control_draft"), {
					...cfgPayload,
					...controlPayload
				});
				toast("TV control draft saved.", "success");
			} else {
				await Promise.all([setDoc(doc(db, "settings", "tv_config"), cfgPayload, { merge: true }), setDoc(doc(db, "settings", "tv_control"), controlPayload, { merge: true })]);
				invalidateCache("doc:settings/tv");
				toast("Live TV display updated.", "success");
			}
		} catch (err) {
			toast(err?.message || "Failed to update TV settings.", "error");
		} finally {
			setSaving(false);
		}
	};
	if (checkingAuth) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-[#F8FAFC] text-xs font-medium text-slate-500",
		children: "Verifying administrator access…"
	});
	const navItems = [
		{
			id: "broadcast",
			label: "Broadcast Mode",
			icon: MonitorPlay
		},
		{
			id: "queue",
			label: "Result Queue",
			icon: ListOrdered,
			badge: queueIds.length
		},
		{
			id: "ticker",
			label: "Ticker & Notices",
			icon: Radio
		},
		{
			id: "theme",
			label: "Visual Theme",
			icon: Palette
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(WorkspaceShell, {
		portalTitle: "TV Display Control",
		portalSubtitle: "Stage Screen Broadcast",
		navItems,
		activeTab,
		onTabChange: setActiveTab,
		userLabel: profile?.displayName || profile?.username || "Admin",
		userSublabel: "Broadcast Controller",
		onLogout: async () => {
			await signOutStaff();
			navigate("/login", { replace: true });
		},
		headerActions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					disabled: saving,
					onClick: () => persistTv("draft"),
					className: "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "h-3.5 w-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Save Draft" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					disabled: saving,
					onClick: () => persistTv("live"),
					className: "inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "h-3.5 w-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Send Live" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionIconButton, {
					icon: ExternalLink,
					label: "Open Live TV screen",
					onClick: () => navigate("/tv")
				})
			]
		}),
		children: [
			activeTab === "broadcast" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-6 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "space-y-4 rounded-xl border border-slate-200 bg-white p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-base font-bold text-slate-900",
							children: "Screen Mode & Playback"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "mb-1.5 block text-xs font-semibold text-slate-700",
							children: "Active Display Mode"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: config.mode || "dashboard",
							onChange: (e) => setConfig({
								...config,
								mode: e.target.value,
								mediaMode: e.target.value
							}),
							className: "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "dashboard",
									children: "Results Spotlight + Leaderboard"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "announcements",
									children: "Full-Screen Announcements"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "youtube",
									children: "YouTube Live / Video Embed"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "video",
									children: "Direct MP4 Video"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "image",
									children: "Image Slide"
								})
							]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-4 sm:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "mb-1.5 block text-xs font-semibold text-slate-700",
								children: "Rotation Interval (sec)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "number",
								min: 5,
								max: 120,
								value: config.rotationSec ?? 12,
								onChange: (e) => setConfig({
									...config,
									rotationSec: Number(e.target.value || 12)
								}),
								className: "w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-xs"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "mb-1.5 block text-xs font-semibold text-slate-700",
								children: "Spotlight Animation"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: config.animationStyle || "spotlight",
								onChange: (e) => setConfig({
									...config,
									animationStyle: e.target.value
								}),
								className: "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "spotlight",
									children: "Spotlight Fade"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "ticker-rise",
									children: "Ticker Rise"
								})]
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "mb-1.5 block text-xs font-semibold text-slate-700",
							children: "Media URL (YouTube / Video / Image)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "url",
							value: config.mediaUrl || "",
							onChange: (e) => setConfig({
								...config,
								mediaUrl: e.target.value
							}),
							placeholder: "https://youtube.com/watch?v=...",
							className: "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "mb-1.5 block text-xs font-semibold text-slate-700",
							children: "Media Caption (Optional)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							value: config.mediaCaption || "",
							onChange: (e) => setConfig({
								...config,
								mediaCaption: e.target.value
							}),
							className: "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
						})] })
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "space-y-4 rounded-xl border border-slate-200 bg-white p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-base font-bold text-slate-900",
							children: "Visible Panels"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs font-semibold",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Show Result Spotlight Card" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: config.show?.results !== false,
								onChange: (e) => setConfig({
									...config,
									show: {
										...config.show || {},
										results: e.target.checked
									}
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs font-semibold",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Show Team Standings Leaderboard" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: config.show?.leaderboard !== false,
								onChange: (e) => setConfig({
									...config,
									show: {
										...config.show || {},
										leaderboard: e.target.checked
									},
									sections: {
										...config.sections || {},
										standings: e.target.checked
									}
								})
							})]
						})
					]
				})]
			}),
			activeTab === "queue" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-6 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "rounded-xl border border-slate-200 bg-white p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-base font-bold text-slate-900",
							children: "Published Results"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 text-xs text-slate-500",
							children: "Add or remove published events in the rotation queue."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 max-h-[460px] divide-y divide-slate-100 overflow-y-auto",
							children: results.map((r) => {
								const eid = r.eventId || r.id;
								const inQueue = queueIds.includes(eid);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-2 py-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "truncate text-xs font-semibold text-slate-900",
											children: r.eventName
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-[11px] text-slate-500",
											children: [
												r.category,
												" · ",
												r.stage
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionIconButton, {
										icon: inQueue ? Trash : Plus,
										label: inQueue ? "Remove from queue" : "Add to queue",
										tone: inQueue ? "danger" : "primary",
										onClick: () => toggleResultInQueue(eid)
									})]
								}, eid);
							})
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "rounded-xl border border-slate-200 bg-white p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-base font-bold text-slate-900",
							children: "Active Rotation Queue"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 text-xs text-slate-500",
							children: "Leave empty to rotate latest 8 published results automatically."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 divide-y divide-slate-100",
							children: queueIds.length ? queueIds.map((eid, idx) => {
								const res = results.find((r) => (r.eventId || r.id) === eid);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-2 py-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "min-w-0",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "truncate text-xs font-semibold text-slate-900",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "mr-2 font-mono-num text-slate-400",
												children: ["#", idx + 1]
											}), res?.eventName || eid]
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionIconButton, {
												icon: ArrowUp,
												label: "Move up",
												disabled: idx === 0,
												onClick: () => moveQueueItem(idx, -1)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionIconButton, {
												icon: ArrowDown,
												label: "Move down",
												disabled: idx === queueIds.length - 1,
												onClick: () => moveQueueItem(idx, 1)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionIconButton, {
												icon: Trash,
												label: "Remove",
												tone: "danger",
												onClick: () => toggleResultInQueue(eid)
											})
										]
									})]
								}, eid);
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "py-10 text-center text-xs text-slate-400",
								children: "Automatic latest-results mode active."
							})
						})
					]
				})]
			}),
			activeTab === "ticker" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4 rounded-xl border border-slate-200 bg-white p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-base font-bold text-slate-900",
						children: "Header, Ticker & Announcements"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-4 sm:grid-cols-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "mb-1 block text-xs font-semibold text-slate-700",
								children: "Screen Title Override"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: config.title || "",
								onChange: (e) => setConfig({
									...config,
									title: e.target.value
								}),
								className: "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "mb-1 block text-xs font-semibold text-slate-700",
								children: "Subtitle"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: config.subtitle || "",
								onChange: (e) => setConfig({
									...config,
									subtitle: e.target.value
								}),
								className: "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "mb-1 block text-xs font-semibold text-slate-700",
								children: "Status Badge Text"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: config.badgeText || "",
								onChange: (e) => setConfig({
									...config,
									badgeText: e.target.value
								}),
								placeholder: "LIVE",
								className: "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "mb-1 block text-xs font-semibold text-slate-700",
						children: "Bottom Ticker Text"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "text",
						value: config.tickerText || "",
						onChange: (e) => setConfig({
							...config,
							tickerText: e.target.value
						}),
						placeholder: "Participants report to Stage 1 15 minutes before event start.",
						className: "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "mb-1 block text-xs font-semibold text-slate-700",
						children: "Full-Screen Announcements (One per line)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						rows: 5,
						value: (config.announcements || []).join("\n"),
						onChange: (e) => setConfig({
							...config,
							announcements: e.target.value.split(/\r?\n/)
						}),
						className: "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
					})] })
				]
			}),
			activeTab === "theme" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4 rounded-xl border border-slate-200 bg-white p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-base font-bold text-slate-900",
					children: "Screen Background"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "mb-1 block text-xs font-semibold text-slate-700",
						children: "Background Color"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "color",
						value: config.background?.color || "#020617",
						onChange: (e) => setConfig({
							...config,
							background: {
								...config.background || {},
								color: e.target.value
							}
						}),
						className: "h-10 w-24 rounded-lg border border-slate-300 p-1"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "mb-1 block text-xs font-semibold text-slate-700",
						children: "Background Image URL"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "url",
						value: config.background?.imageUrl || "",
						onChange: (e) => setConfig({
							...config,
							background: {
								...config.background || {},
								imageUrl: e.target.value
							}
						}),
						placeholder: "https://...",
						className: "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
					})] })]
				})]
			})
		]
	});
};
export { TvControlPage };
