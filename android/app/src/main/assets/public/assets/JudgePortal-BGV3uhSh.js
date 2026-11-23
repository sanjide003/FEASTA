import { n as __toESM } from "./rolldown-runtime-CO0Nlsmt.js";
import { l as require_react, s as useNavigate } from "./router-pSdmx2tz.js";
import { F as ActionIconButton, I as require_jsx_runtime, M as useDialog, O as judgingEnabled, R as getFirebaseState, S as resolveEventScoring, X as Send, ct as createLucideIcon, i as signOutStaff, k as normalizeFestSetup, n as resolveAuthenticatedProfile, nt as Lock, o as CompactDataTable, r as routeForRole, rt as LayoutDashboard, st as CircleCheck, v as createScoringSnapshot, y as defaultScoringRules, z as cachedGetDoc } from "./index-CSlXJ5_1.js";
import { t as ClipboardCheck } from "./clipboard-check-Bycrm83V.js";
import { t as Save } from "./save-PCeAK9Z_.js";
import { E as collection, O as doc, _ as getDocs, b as query, k as documentId$1, s as onAuthStateChanged, w as where, x as runTransaction, y as onSnapshot } from "./firebase-DdS2SgEa.js";
import { t as WorkspaceShell } from "./WorkspaceShell-DgWJk69j.js";
// node_modules/lucide-react/dist/esm/icons/file-pen.mjs
/**
* @license lucide-react v1.78.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var __iconData$1 = {
	name: "file-pen",
	size: 24,
	node: [
		["path", {
			d: "M12.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v9.34",
			key: "o6klzx"
		}],
		["path", {
			d: "M14 2v5a1 1 0 0 0 1 1h5",
			key: "wfsgrz"
		}],
		["path", {
			d: "M10.378 12.622a1 1 0 0 1 3 3.003L8.36 20.637a2 2 0 0 1-.854.506l-2.867.837a.5.5 0 0 1-.62-.62l.836-2.869a2 2 0 0 1 .506-.853z",
			key: "zhnas1"
		}]
	],
	aliases: ["file-edit"]
};
__iconData$1.node;
var FilePen = createLucideIcon(__iconData$1);
// node_modules/lucide-react/dist/esm/icons/sliders-horizontal.mjs
/**
* @license lucide-react v1.78.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var __iconData = {
	name: "sliders-horizontal",
	size: 24,
	node: [
		["path", {
			d: "M10 5H3",
			key: "1qgfaw"
		}],
		["path", {
			d: "M12 19H3",
			key: "yhmn1j"
		}],
		["path", {
			d: "M14 3v4",
			key: "1sua03"
		}],
		["path", {
			d: "M16 17v4",
			key: "1q0r14"
		}],
		["path", {
			d: "M21 12h-9",
			key: "1o4lsq"
		}],
		["path", {
			d: "M21 19h-5",
			key: "1rlt1p"
		}],
		["path", {
			d: "M21 5h-7",
			key: "1oszz2"
		}],
		["path", {
			d: "M8 10v4",
			key: "tgpxqk"
		}],
		["path", {
			d: "M8 12H3",
			key: "a7s4jb"
		}]
	]
};
__iconData.node;
var SlidersHorizontal = createLucideIcon(__iconData);
// src/pages/staff/JudgePortal.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var EVALUATION_OPTIONS = [
	{
		value: "awarded",
		label: "Awarded"
	},
	{
		value: "absent",
		label: "Absent"
	},
	{
		value: "disqualified",
		label: "Disqualified"
	},
	{
		value: "no-award",
		label: "No Award"
	},
	{
		value: "withheld",
		label: "Withheld"
	}
];
var JudgePortal = () => {
	const navigate = useNavigate();
	const { toast, confirm } = useDialog();
	const [checkingAuth, setCheckingAuth] = (0, import_react.useState)(true);
	const [profile, setProfile] = (0, import_react.useState)(null);
	const [activeTab, setActiveTab] = (0, import_react.useState)("overview");
	const [general, setGeneral] = (0, import_react.useState)({});
	const [scoringRules, setScoringRules] = (0, import_react.useState)(() => defaultScoringRules());
	const [assignments, setAssignments] = (0, import_react.useState)([]);
	const [scoresMap, setScoresMap] = (0, import_react.useState)(/* @__PURE__ */ new Map());
	const [eventsMap, setEventsMap] = (0, import_react.useState)(/* @__PURE__ */ new Map());
	const [activeAssignmentId, setActiveAssignmentId] = (0, import_react.useState)("");
	const [participants, setParticipants] = (0, import_react.useState)([]);
	const [draftMarks, setDraftMarks] = (0, import_react.useState)({});
	const [dirty, setDirty] = (0, import_react.useState)(false);
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [openedScoreVersion, setOpenedScoreVersion] = (0, import_react.useState)(0);
	const [loadingWorkspace, setLoadingWorkspace] = (0, import_react.useState)(false);
	const judgeIds = (0, import_react.useMemo)(() => {
		if (!profile) return [];
		return [...new Set([
			profile.uid,
			profile.authUid,
			profile.id,
			profile.accessDocId,
			profile.sourceAccessDocId
		].filter(Boolean).map(String))].slice(0, 10);
	}, [profile]);
	(0, import_react.useEffect)(() => {
		document.title = "Judge Scoring Desk — Feastport";
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
				setCheckingAuth(false);
				navigate("/login", { replace: true });
				return;
			}
			if (p.role !== "judge") {
				navigate(routeForRole(p.role), { replace: true });
				return;
			}
			setProfile(p);
			setCheckingAuth(false);
		});
		return () => unsub();
	}, [navigate]);
	(0, import_react.useEffect)(() => {
		const { db } = getFirebaseState();
		if (!db || !profile || judgeIds.length === 0) return;
		Promise.all([cachedGetDoc(db, "settings", "general"), cachedGetDoc(db, "settings", "scoring_rules")]).then(([gen, rules]) => {
			setGeneral(gen || {});
			setScoringRules(rules || defaultScoringRules());
		});
		const assignQuery = judgeIds.length === 1 ? query(collection(db, "judgeAssignments"), where("judgeId", "==", judgeIds[0])) : query(collection(db, "judgeAssignments"), where("judgeId", "in", judgeIds));
		const scoreQuery = judgeIds.length === 1 ? query(collection(db, "judgeScores"), where("judgeId", "==", judgeIds[0])) : query(collection(db, "judgeScores"), where("judgeId", "in", judgeIds));
		const unsubAssign = onSnapshot(assignQuery, async (snap) => {
			const rows = snap.docs.map((d) => ({
				id: d.id,
				...d.data()
			})).filter((a) => a.active !== false);
			setAssignments(rows);
			const evIds = [...new Set(rows.map((r) => r.eventId).filter(Boolean))];
			const evMap = /* @__PURE__ */ new Map();
			for (let i = 0; i < evIds.length; i += 30) {
				const chunk = evIds.slice(i, i + 30);
				(await getDocs(query(collection(db, "events"), where(documentId$1(), "in", chunk))).catch(() => null))?.docs.forEach((d) => evMap.set(d.id, {
					id: d.id,
					...d.data()
				}));
			}
			setEventsMap(evMap);
		});
		const unsubScores = onSnapshot(scoreQuery, (snap) => {
			const next = /* @__PURE__ */ new Map();
			snap.docs.forEach((d) => {
				const data = {
					id: d.id,
					...d.data()
				};
				next.set(data.assignmentId || d.id, data);
			});
			setScoresMap(next);
		});
		return () => {
			unsubAssign();
			unsubScores();
		};
	}, [profile, judgeIds]);
	const festSetup = (0, import_react.useMemo)(() => normalizeFestSetup(general.festSetup || {}), [general.festSetup]);
	const isJudgingEnabled = judgingEnabled(festSetup);
	const activeAssignment = (0, import_react.useMemo)(() => assignments.find((a) => a.id === activeAssignmentId) || null, [assignments, activeAssignmentId]);
	const activeEvent = activeAssignment ? eventsMap.get(activeAssignment.eventId) || null : null;
	const isReadOnly = (activeAssignment ? scoresMap.get(activeAssignment.id) || null : null)?.status === "submitted";
	const openAssignment = async (assignment) => {
		if (dirty && activeAssignmentId && activeAssignmentId !== assignment.id) {
			if (!await confirm("You have unsaved marks in the current sheet. Discard changes?", {
				title: "Unsaved Changes",
				okLabel: "Discard & Switch"
			})) return;
		}
		const { db } = getFirebaseState();
		const ev = eventsMap.get(assignment.eventId);
		if (!db || !ev) {
			toast("Assigned event details are missing.", "error");
			return;
		}
		setLoadingWorkspace(true);
		setActiveAssignmentId(assignment.id);
		setActiveTab("scoring");
		setDirty(false);
		try {
			const regs = (await getDocs(query(collection(db, "registrations"), where("eventId", "==", ev.id)))).docs.map((d) => ({
				id: d.id,
				...d.data()
			}));
			const allStudentIds = [...new Set(regs.flatMap((r) => r.studentIds || []).filter(Boolean))];
			const stuMap = /* @__PURE__ */ new Map();
			for (let i = 0; i < allStudentIds.length; i += 30) {
				const chunk = allStudentIds.slice(i, i + 30);
				(await getDocs(query(collection(db, "students"), where(documentId$1(), "in", chunk))).catch(() => null))?.docs.forEach((d) => stuMap.set(d.id, {
					id: d.id,
					...d.data()
				}));
			}
			const rows = [];
			if (ev.type === "Group") regs.forEach((r) => {
				const names = (r.studentIds || []).map((sid) => stuMap.get(sid)?.name || sid).filter(Boolean);
				rows.push({
					participantId: r.id,
					label: `Entry #${r.slotIndex || 1} (${names.length} member${names.length === 1 ? "" : "s"})`,
					sublabel: names.join(", ")
				});
			});
			else regs.forEach((r) => {
				(r.studentIds || []).forEach((sid) => {
					if (rows.some((x) => x.participantId === sid)) return;
					const st = stuMap.get(sid);
					rows.push({
						participantId: sid,
						label: st?.chestNo ? `Chest #${st.chestNo}` : st?.name || sid,
						sublabel: st?.name ? `${st.name}${st.category ? ` · ${st.category}` : ""}` : "Student Participant"
					});
				});
			});
			rows.sort((a, b) => a.label.localeCompare(b.label, void 0, { numeric: true }));
			setParticipants(rows);
			const existingScore = scoresMap.get(assignment.id);
			setOpenedScoreVersion(Number(existingScore?.scoreVersion || 0));
			const initial = {};
			rows.forEach((row) => {
				const prev = (existingScore?.marks || []).find((m) => m.participantId === row.participantId);
				initial[row.participantId] = prev ? { ...prev } : {
					participantId: row.participantId,
					rawMark: 0,
					evaluation: "awarded",
					criterionMarks: {}
				};
			});
			setDraftMarks(initial);
		} catch (err) {
			toast(err?.message || "Unable to load event participants.", "error");
		} finally {
			setLoadingWorkspace(false);
		}
	};
	const updateParticipantMark = (pid, patch) => {
		if (isReadOnly || !activeEvent) return;
		setDirty(true);
		setDraftMarks((prev) => {
			const next = {
				...prev[pid] || {
					participantId: pid,
					rawMark: 0,
					evaluation: "awarded",
					criterionMarks: {}
				},
				...patch
			};
			const method = activeEvent.resultMethod || "manual";
			if (method === "criteria" && activeEvent.criteria?.length) {
				const sum = activeEvent.criteria.reduce((s, c) => s + Number(next.criterionMarks?.[c.key] || 0), 0);
				next.rawMark = Number(sum.toFixed(2));
			} else if (method === "objective") {
				const correct = Number(next.correctCount || 0) * Number(activeEvent.objectiveRule?.correctMark ?? 1);
				const wrong = Number(next.wrongCount || 0) * Number(activeEvent.objectiveRule?.wrongPenalty ?? 0);
				next.rawMark = Number(Math.max(0, correct - wrong).toFixed(2));
			} else if (method === "count") {
				const val = Number(next.countValue || 0) - Number(next.penaltyCount || 0) * Number(activeEvent.countRule?.wrongPenalty ?? 0);
				next.rawMark = Number(Math.max(0, val).toFixed(2));
			} else if (method === "time") next.rawMark = Number(next.timeSeconds || 0);
			else if (method === "elimination") next.rawMark = Number(next.eliminationOrder || 0);
			return {
				...prev,
				[pid]: next
			};
		});
	};
	const persistScores = async (targetStatus) => {
		const { db } = getFirebaseState();
		if (!db || !activeAssignment || !activeEvent || !profile) return;
		if (targetStatus === "submitted") {
			if (!await confirm(`Submit final scores for "${activeEvent.name}"? Once submitted, the sheet locks until reopened by Admin.`, {
				title: "Submit Official Score Sheet",
				okLabel: "Submit Final Scores",
				tone: "primary"
			})) return;
		}
		setSaving(true);
		try {
			const marks = participants.map((p) => {
				const m = draftMarks[p.participantId] || {
					participantId: p.participantId,
					rawMark: 0,
					evaluation: "awarded"
				};
				return {
					...m,
					participantId: p.participantId,
					rawMark: Number(m.rawMark || 0),
					evaluation: m.evaluation || "awarded"
				};
			});
			const snapshot = createScoringSnapshot(scoringRules, activeEvent);
			const now = Date.now();
			const scoreRef = doc(db, "judgeScores", activeAssignment.id);
			const pubRef = doc(db, "publicJudgingStatuses", activeAssignment.id);
			await runTransaction(db, async (tx) => {
				const existingSnap = await tx.get(scoreRef);
				const pubSnap = targetStatus === "submitted" ? await tx.get(pubRef) : null;
				if (existingSnap.exists()) {
					const data = existingSnap.data();
					if (data.status === "submitted") throw new Error("This score sheet was already submitted.");
					if (Number(data.scoreVersion || 0) > openedScoreVersion) throw new Error("Score sheet changed remotely. Re-open this assignment before saving.");
				}
				const nextVersion = openedScoreVersion + 1;
				tx.set(scoreRef, {
					assignmentId: activeAssignment.id,
					judgeId: activeAssignment.judgeId,
					judgeName: profile.displayName || profile.username,
					eventId: activeEvent.id,
					eventName: activeEvent.name,
					status: targetStatus,
					marks,
					scoringSnapshot: snapshot,
					scoreVersion: nextVersion,
					updatedAt: now,
					...targetStatus === "submitted" ? { submittedAt: now } : {}
				});
				if (targetStatus === "submitted" && (!pubSnap || !pubSnap.exists())) tx.set(pubRef, {
					assignmentId: activeAssignment.id,
					eventId: activeEvent.id,
					status: "submitted",
					submittedAt: now
				});
				setOpenedScoreVersion(nextVersion);
			});
			setDirty(false);
			toast(targetStatus === "submitted" ? "Score sheet submitted successfully." : "Draft marks saved.", "success");
		} catch (err) {
			toast(err?.message || "Unable to save score sheet.", "error");
		} finally {
			setSaving(false);
		}
	};
	const handleLogout = async () => {
		await signOutStaff();
		navigate("/login", { replace: true });
	};
	const assignedList = assignments.filter((a) => !scoresMap.get(a.id));
	const draftsList = assignments.filter((a) => scoresMap.get(a.id)?.status === "draft");
	const submittedList = assignments.filter((a) => scoresMap.get(a.id)?.status === "submitted");
	const navItems = [
		{
			id: "overview",
			label: "Overview",
			icon: LayoutDashboard
		},
		{
			id: "assigned",
			label: "Pending Events",
			icon: ClipboardCheck,
			badge: assignedList.length
		},
		{
			id: "drafts",
			label: "Saved Drafts",
			icon: FilePen,
			badge: draftsList.length
		},
		{
			id: "submitted",
			label: "Submitted Sheets",
			icon: CircleCheck
		},
		...activeAssignment ? [{
			id: "scoring",
			label: "Scoring Workspace",
			icon: SlidersHorizontal
		}] : []
	];
	const assignmentCols = [
		{
			key: "event",
			header: "Competition",
			render: (a) => {
				const ev = eventsMap.get(a.eventId);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-semibold text-slate-900",
					children: ev?.name || a.eventName || a.eventId
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] text-slate-500",
					children: ev ? `${ev.category} · ${ev.stage} · ${ev.type} · ${ev.resultMethod || "manual"}` : a.category || ""
				})] });
			}
		},
		{
			key: "status",
			header: "Sheet Status",
			render: (a) => {
				const sc = scoresMap.get(a.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: `text-xs font-semibold ${sc?.status === "submitted" ? "text-emerald-700" : sc?.status === "draft" ? "text-amber-700" : "text-slate-500"}`,
					children: sc?.status === "submitted" ? "Submitted (Locked)" : sc?.status === "draft" ? "Draft Saved" : "Not Started"
				});
			}
		},
		{
			key: "actions",
			header: "Action",
			align: "right",
			render: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionIconButton, {
				icon: scoresMap.get(a.id)?.status === "submitted" ? Lock : FilePen,
				label: scoresMap.get(a.id)?.status === "submitted" ? "Inspect submitted sheet" : "Open scoring sheet",
				tone: "primary",
				onClick: () => openAssignment(a)
			})
		}
	];
	const resolvedEventScoring = (0, import_react.useMemo)(() => activeEvent ? resolveEventScoring(scoringRules, activeEvent) : null, [scoringRules, activeEvent]);
	if (checkingAuth) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-[#F8FAFC] text-xs font-medium text-slate-500",
		children: "Verifying judge access…"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkspaceShell, {
		portalTitle: "Judge Scoring Desk",
		portalSubtitle: profile?.displayName || profile?.username || "Adjudicator",
		navItems,
		activeTab,
		onTabChange: setActiveTab,
		userLabel: profile?.displayName || profile?.username || "Judge",
		userSublabel: "Official Adjudicator",
		onLogout: handleLogout,
		children: !isJudgingEnabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm font-medium text-amber-800",
			children: "Judging mode is currently disabled in Festival Setup."
		}) : activeTab === "overview" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-2xl font-bold text-slate-900",
					children: "Adjudicator Overview"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-slate-500",
					children: "Select an assigned competition to evaluate participants."
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 sm:grid-cols-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-slate-200 bg-white p-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] font-semibold uppercase tracking-wider text-slate-500",
								children: "Pending Events"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 font-mono-num text-2xl font-extrabold text-slate-900",
								children: assignedList.length
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-slate-200 bg-white p-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] font-semibold uppercase tracking-wider text-slate-500",
								children: "Drafts in Progress"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 font-mono-num text-2xl font-extrabold text-amber-700",
								children: draftsList.length
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-slate-200 bg-white p-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] font-semibold uppercase tracking-wider text-slate-500",
								children: "Submitted Sheets"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 font-mono-num text-2xl font-extrabold text-emerald-700",
								children: submittedList.length
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompactDataTable, {
					rows: assignments,
					columns: assignmentCols,
					rowKey: (a) => a.id,
					itemLabel: "assignments",
					emptyTitle: "No judge assignments yet",
					emptyDescription: "When an administrator assigns competitions to your account, they will appear here."
				})
			]
		}) : activeTab === "assigned" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompactDataTable, {
			rows: assignedList,
			columns: assignmentCols,
			rowKey: (a) => a.id,
			itemLabel: "pending assignments",
			emptyTitle: "All caught up",
			emptyDescription: "No unstarted competitions remaining."
		}) : activeTab === "drafts" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompactDataTable, {
			rows: draftsList,
			columns: assignmentCols,
			rowKey: (a) => a.id,
			itemLabel: "drafts",
			emptyTitle: "No saved drafts",
			emptyDescription: "Draft sheets you save mid-evaluation will appear here."
		}) : activeTab === "submitted" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompactDataTable, {
			rows: submittedList,
			columns: assignmentCols,
			rowKey: (a) => a.id,
			itemLabel: "submitted sheets",
			emptyTitle: "No submitted sheets",
			emptyDescription: "Finalized score sheets will appear here."
		}) : activeTab === "scoring" && activeEvent && activeAssignment ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-xl font-bold text-slate-900",
					children: activeEvent.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-slate-500",
					children: [
						activeEvent.category,
						" · ",
						activeEvent.stage,
						" · ",
						activeEvent.type,
						" · Method:",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
							className: "uppercase",
							children: activeEvent.resultMethod || "manual"
						}),
						" · Max Mark:",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono-num font-bold",
							children: activeEvent.maximumMark || 100
						})
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center gap-2",
					children: isReadOnly ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "h-3.5 w-3.5" }), " Submitted"]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						disabled: saving || loadingWorkspace,
						onClick: () => persistScores("draft"),
						className: "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "h-3.5 w-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Save Draft" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						disabled: saving || loadingWorkspace,
						onClick: () => persistScores("submitted"),
						className: "inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "h-3.5 w-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Submit Final" })]
					})] })
				})]
			}), loadingWorkspace ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500",
				children: "Loading participant roster…"
			}) : participants.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500",
				children: "No participants registered yet for this competition."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-hidden rounded-xl border border-slate-200 bg-white",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full border-collapse text-left text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3.5 py-2.5",
									children: "Participant / Chest"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3.5 py-2.5",
									children: "Evaluation"
								}),
								activeEvent.resultMethod === "criteria" && activeEvent.criteria?.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
									className: "px-3 py-2.5 text-right",
									children: [
										c.name,
										" (/",
										c.maximumMark,
										")"
									]
								}, c.key)),
								activeEvent.resultMethod === "objective" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 text-right",
									children: "Correct"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 text-right",
									children: "Wrong"
								})] }),
								activeEvent.resultMethod === "count" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 text-right",
									children: "Count"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 text-right",
									children: "Penalty"
								})] }),
								activeEvent.resultMethod === "time" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 text-right",
									children: "Time (sec)"
								}),
								activeEvent.resultMethod === "elimination" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5 text-right",
									children: "Round Order"
								}),
								activeEvent.resultMethod === "direct_rank" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5",
									children: "Position"
								}), resolvedEventScoring?.enabled.grades && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2.5",
									children: "Grade"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3.5 py-2.5 text-right",
									children: "Total Mark"
								})
							]
						}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
							className: "divide-y divide-slate-100",
							children: participants.map((row) => {
								const mark = draftMarks[row.participantId] || {
									participantId: row.participantId,
									rawMark: 0,
									evaluation: "awarded"
								};
								const method = activeEvent.resultMethod || "manual";
								const lockedRow = isReadOnly || mark.evaluation === "absent" || mark.evaluation === "disqualified";
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "hover:bg-slate-50/80",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
											className: "px-3.5 py-2.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "font-mono-num font-bold text-slate-900",
												children: row.label
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[11px] text-slate-500",
												children: row.sublabel
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3.5 py-2.5",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
												disabled: isReadOnly,
												value: mark.evaluation || "awarded",
												onChange: (e) => updateParticipantMark(row.participantId, { evaluation: e.target.value }),
												className: "rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800",
												children: EVALUATION_OPTIONS.map((op) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: op.value,
													children: op.label
												}, op.value))
											})
										}),
										method === "criteria" && activeEvent.criteria?.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3 py-2.5 text-right",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: 0,
												max: c.maximumMark,
												step: "0.5",
												disabled: lockedRow,
												value: mark.criterionMarks?.[c.key] ?? "",
												onChange: (e) => {
													const val = Math.min(c.maximumMark, Math.max(0, Number(e.target.value || 0)));
													updateParticipantMark(row.participantId, { criterionMarks: {
														...mark.criterionMarks || {},
														[c.key]: val
													} });
												},
												className: "w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
											})
										}, c.key)),
										method === "objective" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3 py-2.5 text-right",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: 0,
												disabled: lockedRow,
												value: mark.correctCount ?? 0,
												onChange: (e) => updateParticipantMark(row.participantId, { correctCount: Math.max(0, Number(e.target.value || 0)) }),
												className: "w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3 py-2.5 text-right",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: 0,
												disabled: lockedRow,
												value: mark.wrongCount ?? 0,
												onChange: (e) => updateParticipantMark(row.participantId, { wrongCount: Math.max(0, Number(e.target.value || 0)) }),
												className: "w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
											})
										})] }),
										method === "count" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3 py-2.5 text-right",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: 0,
												disabled: lockedRow,
												value: mark.countValue ?? 0,
												onChange: (e) => updateParticipantMark(row.participantId, { countValue: Math.max(0, Number(e.target.value || 0)) }),
												className: "w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3 py-2.5 text-right",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: 0,
												disabled: lockedRow,
												value: mark.penaltyCount ?? 0,
												onChange: (e) => updateParticipantMark(row.participantId, { penaltyCount: Math.max(0, Number(e.target.value || 0)) }),
												className: "w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
											})
										})] }),
										method === "time" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3 py-2.5 text-right",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: 0,
												step: "0.01",
												disabled: lockedRow,
												value: mark.timeSeconds ?? 0,
												onChange: (e) => updateParticipantMark(row.participantId, { timeSeconds: Math.max(0, Number(e.target.value || 0)) }),
												className: "w-24 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
											})
										}),
										method === "elimination" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3 py-2.5 text-right",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: 1,
												disabled: lockedRow,
												value: mark.eliminationOrder ?? 1,
												onChange: (e) => updateParticipantMark(row.participantId, { eliminationOrder: Math.max(1, Number(e.target.value || 1)) }),
												className: "w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num text-xs"
											})
										}),
										method === "direct_rank" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3 py-2.5",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												disabled: lockedRow,
												value: mark.position || "",
												onChange: (e) => updateParticipantMark(row.participantId, { position: e.target.value }),
												className: "rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "",
													children: "None"
												}), (resolvedEventScoring?.config.points || []).map((pt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: pt.label,
													children: pt.label
												}, pt.key))]
											})
										}), resolvedEventScoring?.enabled.grades && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3 py-2.5",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												disabled: lockedRow,
												value: mark.grade || "",
												onChange: (e) => updateParticipantMark(row.participantId, { grade: e.target.value }),
												className: "rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "",
													children: "None"
												}), (resolvedEventScoring?.config.grades || []).map((gr) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: gr.label,
													children: gr.label
												}, gr.key))]
											})
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-3.5 py-2.5 text-right",
											children: method === "manual" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: 0,
												max: activeEvent.maximumMark || 100,
												step: "0.5",
												disabled: lockedRow,
												value: mark.rawMark ?? 0,
												onChange: (e) => updateParticipantMark(row.participantId, { rawMark: Math.min(Number(activeEvent.maximumMark || 100), Math.max(0, Number(e.target.value || 0))) }),
												className: "w-24 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono-num font-bold text-slate-900"
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-mono-num text-sm font-bold text-slate-900",
												children: Number(mark.rawMark || 0)
											})
										})
									]
								}, row.participantId);
							})
						})]
					})
				})
			})]
		}) : null
	});
};
export { JudgePortal };
