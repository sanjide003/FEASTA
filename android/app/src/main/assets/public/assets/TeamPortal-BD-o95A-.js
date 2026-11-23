import { n as __toESM } from "./rolldown-runtime-CO0Nlsmt.js";
import { l as require_react, s as useNavigate } from "./router-pSdmx2tz.js";
import { a as Check, i as ClipboardList, n as Printer, o as CalendarClock, r as Megaphone, t as Users } from "./users-D5PH0vYF.js";
import { B as cachedGetDocs, D as resolveDisplayName, E as printPage, F as ActionIconButton, I as require_jsx_runtime, J as ShieldExclamationPoint, M as useDialog, P as Modal, Q as RefreshCw, R as getFirebaseState, T as normalizeResultData, U as X, V as invalidateCache, W as UserPlus, c as normalizeTeamRegistrationPolicy, ct as createLucideIcon, i as signOutStaff, it as Eye, j as teamColor, l as participationLimitDecision, n as resolveAuthenticatedProfile, o as CompactDataTable, r as routeForRole, rt as LayoutDashboard, s as normalizeRegistrationConfig, u as participationUsage, w as formatTime12h, z as cachedGetDoc } from "./index-CSlXJ5_1.js";
import { t as Trash } from "./trash-CCZobr2w.js";
import { C as updateDoc, E as collection, O as doc, S as setDoc, b as query, m as deleteDoc, p as addDoc, s as onAuthStateChanged, w as where } from "./firebase-DdS2SgEa.js";
import { t as WorkspaceShell } from "./WorkspaceShell-DgWJk69j.js";
// node_modules/lucide-react/dist/esm/icons/file-chart-column.mjs
/**
* @license lucide-react v1.78.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var __iconData = {
	name: "file-chart-column",
	size: 24,
	node: [
		["path", {
			d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
			key: "1oefj6"
		}],
		["path", {
			d: "M14 2v5a1 1 0 0 0 1 1h5",
			key: "wfsgrz"
		}],
		["path", {
			d: "M8 18v-1",
			key: "zg0ygc"
		}],
		["path", {
			d: "M12 18v-6",
			key: "17g6i2"
		}],
		["path", {
			d: "M16 18v-3",
			key: "j5jt4h"
		}]
	],
	aliases: ["file-bar-chart-2"]
};
__iconData.node;
var FileChartColumn = createLucideIcon(__iconData);
// src/pages/staff/TeamPortal.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var TeamPortal = () => {
	const navigate = useNavigate();
	const { toast, confirm } = useDialog();
	const [checkingAuth, setCheckingAuth] = (0, import_react.useState)(true);
	const [profile, setProfile] = (0, import_react.useState)(null);
	const [activeTab, setActiveTab] = (0, import_react.useState)("overview");
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [general, setGeneral] = (0, import_react.useState)({});
	const [regConfig, setRegConfig] = (0, import_react.useState)({});
	const [scheduleConfig, setScheduleConfig] = (0, import_react.useState)({});
	const [teamPolicy, setTeamPolicy] = (0, import_react.useState)({});
	const [students, setStudents] = (0, import_react.useState)([]);
	const [events, setEvents] = (0, import_react.useState)([]);
	const [registrations, setRegistrations] = (0, import_react.useState)([]);
	const [requests, setRequests] = (0, import_react.useState)([]);
	const [breaks, setBreaks] = (0, import_react.useState)([]);
	const [notices, setNotices] = (0, import_react.useState)([]);
	const [results, setResults] = (0, import_react.useState)([]);
	const [reqFilter, setReqFilter] = (0, import_react.useState)("pending");
	const [eventSearch, setEventSearch] = (0, import_react.useState)("");
	const [eventCatFilter, setEventCatFilter] = (0, import_react.useState)("All");
	const [eventStageFilter, setEventStageFilter] = (0, import_react.useState)("All");
	const [bwPrint, setBwPrint] = (0, import_react.useState)(false);
	const [inspectReq, setInspectReq] = (0, import_react.useState)(null);
	const [manageEvent, setManageEvent] = (0, import_react.useState)(null);
	const [slotDrafts, setSlotDrafts] = (0, import_react.useState)({});
	const [savingSlots, setSavingSlots] = (0, import_react.useState)(false);
	const [scheduleEventModal, setScheduleEventModal] = (0, import_react.useState)(null);
	const loadTeamData = (0, import_react.useCallback)(async (userProfile, forceRefresh = false) => {
		const { db } = getFirebaseState();
		if (!db || !userProfile.team) return;
		setLoading(true);
		const teamId = userProfile.team;
		try {
			if (forceRefresh) invalidateCache();
			const [genDoc, regCfgDoc, schedCfgDoc, policyDoc, teamStudents, allEvents, teamRegs, teamReqs, allBreaks, teamNotices, pubResults] = await Promise.all([
				cachedGetDoc(db, "settings", "general", { forceRefresh }),
				cachedGetDoc(db, "settings", "registration_config", { forceRefresh }),
				cachedGetDoc(db, "settings", "schedule_config", { forceRefresh }),
				cachedGetDoc(db, "teamRegistrationPolicies", teamId, { forceRefresh }),
				cachedGetDocs(`team:${teamId}:students`, query(collection(db, "students"), where("team", "==", teamId)), { forceRefresh }),
				cachedGetDocs("events:all", collection(db, "events"), { forceRefresh }),
				cachedGetDocs(`team:${teamId}:registrations`, query(collection(db, "registrations"), where("team", "==", teamId)), { forceRefresh }),
				cachedGetDocs(`team:${teamId}:requests`, query(collection(db, "registrationRequests"), where("team", "==", teamId)), { forceRefresh }),
				cachedGetDocs("scheduleBreaks:all", collection(db, "scheduleBreaks"), { forceRefresh }),
				cachedGetDocs(`team:${teamId}:notices`, query(collection(db, "notifications"), where("team", "in", ["All", teamId])), { forceRefresh }),
				cachedGetDocs("results:published", query(collection(db, "results"), where("status", "==", "published")), { forceRefresh })
			]);
			setGeneral(genDoc || {});
			setRegConfig(normalizeRegistrationConfig(regCfgDoc || {}));
			setScheduleConfig(schedCfgDoc || {});
			setTeamPolicy(normalizeTeamRegistrationPolicy(policyDoc || {}));
			setStudents(teamStudents.sort((a, b) => a.name.localeCompare(b.name)));
			setEvents(allEvents.filter((e) => !e.cancelled).sort((a, b) => a.name.localeCompare(b.name)));
			setRegistrations(teamRegs);
			setRequests(teamReqs.sort((a, b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0)));
			setBreaks(allBreaks.filter((b) => b.active !== false));
			setNotices(teamNotices.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)));
			setResults(pubResults);
		} catch (err) {
			toast(err?.message || "Failed to load team workspace data.", "error");
		} finally {
			setLoading(false);
		}
	}, [toast]);
	(0, import_react.useEffect)(() => {
		document.title = "Team Leader Portal — Feastport";
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
			if (p.role !== "teamLeader" || !p.team) {
				navigate(routeForRole(p.role), { replace: true });
				return;
			}
			setProfile(p);
			setCheckingAuth(false);
			loadTeamData(p);
		});
		return () => unsub();
	}, [navigate, loadTeamData]);
	const teamId = profile?.team || "";
	const genderScope = profile?.genderScope || "Both";
	const teamLabel = resolveDisplayName(general.teamDisplayNames, teamId, teamId || "Team");
	const accentColor = teamColor(teamId, general.teamColors);
	const categories = (0, import_react.useMemo)(() => general.categories || [], [general.categories]);
	const catName = (k) => resolveDisplayName(general.categoryDisplayNames, k, "General");
	const registrationLockAt = Number(scheduleConfig.registrationLockAt || 0);
	const registrationLocked = Boolean(registrationLockAt && Date.now() >= registrationLockAt);
	const scopedStudents = (0, import_react.useMemo)(() => {
		if (genderScope === "Both") return students;
		return students.filter((s) => s.gender === genderScope);
	}, [students, genderScope]);
	const scopedEvents = (0, import_react.useMemo)(() => {
		return events.filter((ev) => {
			if (genderScope === "Both") return true;
			return !ev.gender || ev.gender === "Both" || ev.gender === "Mixed" || ev.gender === genderScope;
		});
	}, [events, genderScope]);
	const regsByEvent = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const r of registrations) {
			const list = map.get(r.eventId) || [];
			list.push(r);
			map.set(r.eventId, list);
		}
		return map;
	}, [registrations]);
	const studentEventMap = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const r of registrations) for (const sid of r.studentIds || []) {
			const list = map.get(sid) || [];
			if (!list.includes(r.eventId)) list.push(r.eventId);
			map.set(sid, list);
		}
		return map;
	}, [registrations]);
	const pendingRequestsCount = (0, import_react.useMemo)(() => requests.filter((r) => [
		"pending",
		"applied",
		"under_review",
		"waitlisted"
	].includes(r.status)).length, [requests]);
	const updateTeamPolicy = async (mode, studentApplicationsEnabled) => {
		const { db, auth } = getFirebaseState();
		if (!db || !auth?.currentUser || !teamId) return;
		try {
			const payload = {
				team: teamId,
				mode,
				studentApplicationsEnabled,
				changedByUid: auth.currentUser.uid,
				updatedAt: Date.now()
			};
			await setDoc(doc(db, "teamRegistrationPolicies", teamId), payload, { merge: true });
			setTeamPolicy((prev) => ({
				...prev,
				...payload
			}));
			invalidateCache(`doc:teamRegistrationPolicies/${teamId}`);
			toast("Team registration policy saved.", "success");
		} catch (err) {
			toast(err?.message || "Unable to update policy.", "error");
		}
	};
	const filteredRequests = (0, import_react.useMemo)(() => {
		return requests.filter((r) => {
			if (reqFilter === "pending") return [
				"pending",
				"applied",
				"under_review",
				"waitlisted"
			].includes(r.status);
			if (reqFilter === "approved") return [
				"approved",
				"selected",
				"finalized"
			].includes(r.status);
			if (reqFilter === "rejected") return ["rejected", "not_selected"].includes(r.status);
			return true;
		});
	}, [requests, reqFilter]);
	const handleRequestDecision = async (req, decision) => {
		const { db, auth } = getFirebaseState();
		if (!db || !auth?.currentUser || !profile) return;
		if (registrationLocked) {
			toast("Registrations are locked by schedule deadline.", "error");
			return;
		}
		const uid = auth.currentUser.uid;
		try {
			if (decision === "approved") {
				const student = students.find((s) => s.id === req.relatedStudentId);
				if (!student) {
					toast("Matching student record not found in this team.", "error");
					return;
				}
				const existingEventIds = studentEventMap.get(student.id) || [];
				let usage = participationUsage(existingEventIds, events, regConfig);
				for (const evId of req.eventIds || []) {
					const ev = events.find((e) => e.id === evId);
					if (!ev) continue;
					if (existingEventIds.includes(evId)) continue;
					if (!participationLimitDecision(regConfig, ev, usage).allowed) {
						toast(`${student.name} exceeded participation limit for ${ev.name}.`, "warning");
						return;
					}
					const evRegs = regsByEvent.get(evId) || [];
					const maxSlots = Math.max(1, Number(ev.limit || 1));
					const maxMembers = ev.type === "Group" ? Math.max(1, Number(ev.maximumMembers || ev.groupSize || 1)) : 1;
					let targetReg = evRegs.find((r) => (r.studentIds || []).length < maxMembers);
					if (!targetReg && evRegs.length >= maxSlots) {
						toast(`All ${maxSlots} team slot(s) for ${ev.name} are already full.`, "warning");
						return;
					}
					const now = Date.now();
					if (targetReg) {
						const nextIds = [.../* @__PURE__ */ new Set([...targetReg.studentIds || [], student.id])];
						await updateDoc(doc(db, "registrations", targetReg.id), {
							studentIds: nextIds,
							lastUpdatedByUid: uid,
							lastUpdatedAt: now,
							createdByUid: targetReg.createdByUid || uid,
							createdAt: targetReg.createdAt || now,
							managedGender: targetReg.managedGender || genderScope
						});
					} else {
						const usedSlotIndexes = new Set(evRegs.map((r) => Number(r.slotIndex || 1)));
						let slotIndex = 1;
						while (usedSlotIndexes.has(slotIndex)) slotIndex += 1;
						await addDoc(collection(db, "registrations"), {
							eventId: ev.id,
							eventName: ev.name,
							team: teamId,
							slotIndex,
							studentIds: [student.id],
							participantIds: [],
							managedGender: genderScope,
							createdByUid: uid,
							lastUpdatedByUid: uid,
							createdAt: now,
							lastUpdatedAt: now
						});
					}
					usage = participationUsage([...existingEventIds, evId], events, regConfig);
				}
			}
			const now = Date.now();
			await updateDoc(doc(db, "registrationRequests", req.id), {
				status: decision,
				decisionByUid: uid,
				decisionByName: profile.displayName || profile.username,
				decisionByRole: "teamLeader",
				decisionByUsername: profile.username,
				decisionAt: now,
				reviewedAt: now
			});
			toast(`Request ${decision === "approved" ? "approved and registered" : "rejected"}.`, "success");
			if (inspectReq?.id === req.id) setInspectReq(null);
			await loadTeamData(profile, true);
		} catch (err) {
			toast(err?.message || "Failed to save request decision.", "error");
		}
	};
	const openManageSlots = (ev) => {
		const evRegs = regsByEvent.get(ev.id) || [];
		const maxSlots = Math.max(1, Number(ev.limit || 1));
		const drafts = {};
		for (let s = 1; s <= maxSlots; s += 1) {
			const existing = evRegs.find((r) => Number(r.slotIndex || 1) === s);
			drafts[s] = existing?.studentIds ? [...existing.studentIds] : [];
		}
		setSlotDrafts(drafts);
		setManageEvent(ev);
	};
	const eligibleStudentsForManageEvent = (0, import_react.useMemo)(() => {
		if (!manageEvent) return [];
		return scopedStudents.filter((s) => {
			if (manageEvent.category && manageEvent.category !== "General" && s.category !== manageEvent.category) return false;
			if (manageEvent.gender && !["Both", "Mixed"].includes(manageEvent.gender) && s.gender !== manageEvent.gender) return false;
			if (manageEvent.eligibleClasses?.length) {
				const cls = String(s.details?.class || s.class || "").trim();
				if (!manageEvent.eligibleClasses.map(String).includes(cls)) return false;
			}
			return true;
		});
	}, [manageEvent, scopedStudents]);
	const toggleStudentInSlot = (slotIdx, studentId) => {
		if (!manageEvent) return;
		const maxMembers = manageEvent.type === "Group" ? Math.max(1, Number(manageEvent.maximumMembers || manageEvent.groupSize || 1)) : 1;
		const current = slotDrafts[slotIdx] || [];
		if (current.includes(studentId)) {
			setSlotDrafts((prev) => ({
				...prev,
				[slotIdx]: current.filter((id) => id !== studentId)
			}));
			return;
		}
		for (const [k, list] of Object.entries(slotDrafts)) if (Number(k) !== slotIdx && list.includes(studentId)) {
			toast("Student is already assigned to another slot in this event.", "warning");
			return;
		}
		if (current.length >= maxMembers) {
			toast(`Slot ${slotIdx} accepts maximum ${maxMembers} participant(s).`, "warning");
			return;
		}
		const existingIds = (studentEventMap.get(studentId) || []).filter((eid) => eid !== manageEvent.id);
		const usage = participationUsage(existingIds, events, regConfig);
		if (!participationLimitDecision(regConfig, manageEvent, usage).allowed) {
			toast("Student reached maximum participation limit for this event type/stage.", "warning");
			return;
		}
		setSlotDrafts((prev) => ({
			...prev,
			[slotIdx]: [...current, studentId]
		}));
	};
	const saveManageSlots = async () => {
		const { db, auth } = getFirebaseState();
		if (!db || !auth?.currentUser || !manageEvent || !profile) return;
		if (registrationLocked) {
			toast("Registrations are locked by deadline.", "error");
			return;
		}
		setSavingSlots(true);
		const uid = auth.currentUser.uid;
		const now = Date.now();
		try {
			const existingRegs = regsByEvent.get(manageEvent.id) || [];
			for (const [slotStr, studentIds] of Object.entries(slotDrafts)) {
				const slotIndex = Number(slotStr);
				const existing = existingRegs.find((r) => Number(r.slotIndex || 1) === slotIndex);
				if (studentIds.length === 0) {
					if (existing) await deleteDoc(doc(db, "registrations", existing.id));
				} else if (existing) await updateDoc(doc(db, "registrations", existing.id), {
					studentIds,
					participantIds: [],
					eventName: manageEvent.name,
					team: teamId,
					slotIndex,
					managedGender: existing.managedGender || genderScope,
					createdByUid: existing.createdByUid || uid,
					createdAt: existing.createdAt || now,
					lastUpdatedByUid: uid,
					lastUpdatedAt: now
				});
				else await addDoc(collection(db, "registrations"), {
					eventId: manageEvent.id,
					eventName: manageEvent.name,
					team: teamId,
					slotIndex,
					studentIds,
					participantIds: [],
					managedGender: genderScope,
					createdByUid: uid,
					lastUpdatedByUid: uid,
					createdAt: now,
					lastUpdatedAt: now
				});
			}
			toast(`Saved entries for ${manageEvent.name}.`, "success");
			setManageEvent(null);
			await loadTeamData(profile, true);
		} catch (err) {
			toast(err?.message || "Unable to save slot assignments.", "error");
		} finally {
			setSavingSlots(false);
		}
	};
	const clearEventRegistrations = async (ev) => {
		const { db } = getFirebaseState();
		if (!db || !profile) return;
		const evRegs = regsByEvent.get(ev.id) || [];
		if (!evRegs.length) return;
		if (registrationLocked) {
			toast("Registrations are locked by deadline.", "error");
			return;
		}
		if (!await confirm(`Remove all ${teamLabel} entries from "${ev.name}"?`, {
			title: "Clear Team Entries",
			okLabel: "Remove All"
		})) return;
		try {
			for (const r of evRegs) await deleteDoc(doc(db, "registrations", r.id));
			toast(`Cleared entries for ${ev.name}.`, "success");
			await loadTeamData(profile, true);
		} catch (err) {
			toast(err?.message || "Failed to remove entries.", "error");
		}
	};
	const filteredEvents = (0, import_react.useMemo)(() => {
		const q = eventSearch.trim().toLowerCase();
		return scopedEvents.filter((ev) => {
			if (eventCatFilter !== "All" && ev.category !== eventCatFilter) return false;
			if (eventStageFilter !== "All" && ev.stage !== eventStageFilter) return false;
			if (q && !`${ev.name} ${ev.code || ""} ${ev.category}`.toLowerCase().includes(q)) return false;
			return true;
		});
	}, [
		scopedEvents,
		eventSearch,
		eventCatFilter,
		eventStageFilter
	]);
	const teamScheduledEvents = (0, import_react.useMemo)(() => {
		return scopedEvents.filter((ev) => (regsByEvent.get(ev.id) || []).some((r) => (r.studentIds || []).length > 0)).filter((ev) => ev.scheduleDate || ev.date || ev.time || ev.scheduleStage).sort((a, b) => `${a.scheduleDate || a.date || ""} ${a.time || ""}`.localeCompare(`${b.scheduleDate || b.date || ""} ${b.time || ""}`));
	}, [scopedEvents, regsByEvent]);
	const teamPublishedResults = (0, import_react.useMemo)(() => {
		return results.map((r) => normalizeResultData(r)).filter((r) => {
			const placeHasTeam = r.places.some((p) => p.winners.some((w) => w.team === teamId));
			const gradeHasTeam = (r.gradeAwards || []).some((g) => g.winners.some((w) => w.team === teamId));
			return placeHasTeam || gradeHasTeam;
		}).sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0));
	}, [results, teamId]);
	const handleLogout = async () => {
		await signOutStaff();
		navigate("/login", { replace: true });
	};
	if (checkingAuth) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-[#F8FAFC] text-xs font-medium text-slate-500",
		children: "Verifying team leader access…"
	});
	const navItems = [
		{
			id: "overview",
			label: "Overview & Policy",
			icon: LayoutDashboard
		},
		{
			id: "requests",
			label: "Student Requests",
			icon: ClipboardList,
			badge: pendingRequestsCount
		},
		{
			id: "entries",
			label: "Events & Entries",
			icon: Users
		},
		{
			id: "schedule",
			label: "Team Schedule",
			icon: CalendarClock
		},
		{
			id: "reports",
			label: "Reports & Results",
			icon: FileChartColumn
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(WorkspaceShell, {
		portalTitle: `${teamLabel} Portal`,
		portalSubtitle: `Team Leader · Scope: ${genderScope}`,
		navItems,
		activeTab,
		onTabChange: setActiveTab,
		userLabel: profile?.displayName || profile?.username || "Team Leader",
		userSublabel: `${teamLabel} (${genderScope})`,
		onLogout: handleLogout,
		headerActions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionIconButton, {
			icon: RefreshCw,
			label: "Refresh team data",
			onClick: () => profile && loadTeamData(profile, true)
		}),
		children: [
			registrationLocked && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldExclamationPoint, { className: "h-4 w-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Registration editing is locked because the festival deadline has passed." })]
			}),
			activeTab === "overview" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "h-4 w-4 rounded-full",
							style: { background: accentColor }
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
							className: "font-display text-2xl font-bold text-slate-900",
							children: [teamLabel, " Workspace"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-500",
							children: "Manage student entries, review self-registration applications, and monitor official results."
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl border border-slate-200 bg-white p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] font-semibold uppercase tracking-wider text-slate-500",
									children: "Team Students"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 font-mono-num text-2xl font-extrabold text-slate-900",
									children: scopedStudents.length
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl border border-slate-200 bg-white p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] font-semibold uppercase tracking-wider text-slate-500",
									children: "Event Slots Filled"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 font-mono-num text-2xl font-extrabold text-slate-900",
									children: registrations.length
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl border border-slate-200 bg-white p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] font-semibold uppercase tracking-wider text-slate-500",
									children: "Pending Requests"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 font-mono-num text-2xl font-extrabold text-amber-700",
									children: pendingRequestsCount
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl border border-slate-200 bg-white p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] font-semibold uppercase tracking-wider text-slate-500",
									children: "Published Wins"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 font-mono-num text-2xl font-extrabold text-emerald-700",
									children: teamPublishedResults.length
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-6 lg:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "rounded-xl border border-slate-200 bg-white p-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-base font-bold text-slate-900",
									children: "Self-Registration Policy"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-xs text-slate-500",
									children: [
										"Control whether students from ",
										teamLabel,
										" can submit new self-registration applications."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 space-y-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-semibold text-slate-800",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Accept student applications for ", teamLabel] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: teamPolicy.studentApplicationsEnabled !== false,
											onChange: (e) => updateTeamPolicy(teamPolicy.mode || "open", e.target.checked),
											className: "h-4 w-4 rounded border-slate-300 text-blue-700"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "mb-1.5 block text-xs font-semibold text-slate-700",
										children: "Slot Mode"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: teamPolicy.mode || "open",
										onChange: (e) => updateTeamPolicy(e.target.value, teamPolicy.studentApplicationsEnabled !== false),
										className: "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-blue-600",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "open",
												children: "Open (Accept all applications)"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "unfilled_only",
												children: "Unfilled Events Only"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "waitlist_only",
												children: "Waitlist Only when Full"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "closed",
												children: "Closed"
											})
										]
									})] })]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "rounded-xl border border-slate-200 bg-white p-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Megaphone, { className: "h-4 w-4 text-blue-700" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-base font-bold text-slate-900",
									children: "Official Announcements"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-4 divide-y divide-slate-100",
								children: notices.length ? notices.slice(0, 6).map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "py-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs font-bold text-slate-900",
										children: n.title
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-0.5 text-xs text-slate-600",
										children: n.message
									})]
								}, n.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "py-6 text-center text-xs text-slate-400",
									children: [
										"No notices sent to ",
										teamLabel,
										"."
									]
								})
							})]
						})]
					})
				]
			}),
			activeTab === "requests" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-xl font-bold text-slate-900",
						children: "Student Registration Requests"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-slate-500",
						children: "Approve or reject applications submitted via Registration Portal."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center gap-2",
						children: [
							"pending",
							"approved",
							"rejected",
							"all"
						].map((status) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setReqFilter(status),
							className: `rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize ${reqFilter === status ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`,
							children: status
						}, status))
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompactDataTable, {
					rows: filteredRequests,
					columns: [
						{
							key: "student",
							header: "Student",
							render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate font-semibold text-slate-900",
									children: r.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-[11px] text-slate-500",
									children: [
										catName(r.category),
										" · ",
										r.gender
									]
								})]
							})
						},
						{
							key: "events",
							header: "Requested Events",
							render: (r) => {
								const names = (r.eventIds || []).map((eid) => events.find((e) => e.id === eid)?.name || eid).join(", ");
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "line-clamp-2 max-w-xs text-slate-700",
									children: names || "—"
								});
							}
						},
						{
							key: "status",
							header: "Status",
							render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `text-xs font-semibold capitalize ${r.status === "approved" || r.status === "finalized" || r.status === "selected" ? "text-emerald-700" : r.status === "rejected" || r.status === "not_selected" ? "text-red-600" : "text-amber-700"}`,
								children: r.status.replace(/_/g, " ")
							})
						},
						{
							key: "actions",
							header: "Actions",
							align: "right",
							render: (r) => {
								const isPending = [
									"pending",
									"applied",
									"under_review",
									"waitlisted"
								].includes(r.status);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-end gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionIconButton, {
										icon: Eye,
										label: "Inspect request",
										onClick: () => setInspectReq(r)
									}), isPending && !registrationLocked && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionIconButton, {
										icon: Check,
										label: "Approve request",
										tone: "success",
										onClick: () => handleRequestDecision(r, "approved")
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionIconButton, {
										icon: X,
										label: "Reject request",
										tone: "danger",
										onClick: () => handleRequestDecision(r, "rejected")
									})] })]
								});
							}
						}
					],
					rowKey: (r) => r.id,
					loading,
					itemLabel: "requests",
					emptyTitle: "No matching requests",
					emptyDescription: "Requests matching the selected status filter will appear here."
				})]
			}),
			activeTab === "entries" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-xl font-bold text-slate-900",
						children: "Events & Slot Entries"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-slate-500",
						children: [
							"Assign eligible ",
							teamLabel,
							" students into available event slots."
						]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "search",
								value: eventSearch,
								onChange: (e) => setEventSearch(e.target.value),
								placeholder: "Search event…",
								className: "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: eventCatFilter,
								onChange: (e) => setEventCatFilter(e.target.value),
								className: "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "All",
										children: "All Categories"
									}),
									categories.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: c,
										children: catName(c)
									}, c)),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "General",
										children: "General"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: eventStageFilter,
								onChange: (e) => setEventStageFilter(e.target.value),
								className: "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "All",
										children: "All Stages"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "On-Stage",
										children: "On-Stage"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "Off-Stage",
										children: "Off-Stage"
									})
								]
							})
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompactDataTable, {
					rows: filteredEvents,
					columns: [
						{
							key: "event",
							header: "Event",
							render: (ev) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-semibold text-slate-900",
									children: ev.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-[11px] text-slate-500",
									children: [
										catName(ev.category),
										" · ",
										ev.stage,
										" · ",
										ev.type,
										" · ",
										ev.gender
									]
								})]
							})
						},
						{
							key: "slots",
							header: "Team Entries",
							render: (ev) => {
								const evRegs = regsByEvent.get(ev.id) || [];
								const maxSlots = Math.max(1, Number(ev.limit || 1));
								const filledSlots = evRegs.filter((r) => (r.studentIds || []).length > 0).length;
								const memberNames = evRegs.flatMap((r) => r.studentIds || []).map((sid) => students.find((s) => s.id === sid)?.name).filter(Boolean);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono-num text-xs font-bold text-slate-900",
									children: [
										filledSlots,
										" / ",
										maxSlots,
										" slot",
										maxSlots > 1 ? "s" : ""
									]
								}), memberNames.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-0.5 line-clamp-1 max-w-xs text-[11px] text-slate-500",
									children: memberNames.join(", ")
								})] });
							}
						},
						{
							key: "actions",
							header: "Actions",
							align: "right",
							render: (ev) => {
								const hasEntries = (regsByEvent.get(ev.id) || []).length > 0;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-end gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionIconButton, {
										icon: UserPlus,
										label: "Manage team slots",
										tone: "primary",
										onClick: () => openManageSlots(ev)
									}), hasEntries && !registrationLocked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionIconButton, {
										icon: Trash,
										label: "Clear team entries",
										tone: "danger",
										onClick: () => clearEventRegistrations(ev)
									})]
								});
							}
						}
					],
					rowKey: (ev) => ev.id,
					loading,
					itemLabel: "events",
					emptyTitle: "No events found",
					emptyDescription: "Try clearing category or stage filters."
				})]
			}),
			activeTab === "schedule" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "font-display text-xl font-bold text-slate-900",
						children: [teamLabel, " Event Schedule"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-slate-500",
						children: [
							"Confirmed scheduled events with ",
							teamLabel,
							" entries."
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompactDataTable, {
						rows: teamScheduledEvents,
						columns: [
							{
								key: "when",
								header: "Date & Time",
								render: (ev) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "font-mono-num text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-semibold text-slate-900",
										children: ev.scheduleDate || ev.date || "TBA"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[11px] text-slate-500",
										children: ev.time ? formatTime12h(ev.time) : "TBD"
									})]
								})
							},
							{
								key: "event",
								header: "Event",
								render: (ev) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-semibold text-slate-900",
									children: ev.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-[11px] text-slate-500",
									children: [
										catName(ev.category),
										" · ",
										ev.scheduleStage || ev.stage
									]
								})] })
							},
							{
								key: "participants",
								header: "Participants",
								align: "right",
								render: (ev) => {
									const count = (regsByEvent.get(ev.id) || []).reduce((s, r) => s + (r.studentIds || []).length, 0);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-end gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono-num text-xs font-bold text-slate-700",
											children: count
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionIconButton, {
											icon: Users,
											label: "View registered participants",
											onClick: () => setScheduleEventModal(ev)
										})]
									});
								}
							}
						],
						rowKey: (ev) => ev.id,
						loading,
						itemLabel: "scheduled events",
						emptyTitle: "No scheduled team events",
						emptyDescription: "Events become visible here once scheduled and your team assigns entries."
					}),
					breaks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-slate-200 bg-white p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-xs font-bold uppercase tracking-wider text-slate-500",
							children: "Scheduled Breaks"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 divide-y divide-slate-100 text-xs",
							children: breaks.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between py-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-semibold text-slate-800",
									children: b.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-mono-num text-slate-500",
									children: [
										b.date,
										" · ",
										formatTime12h(b.startTime),
										" – ",
										formatTime12h(b.endTime)
									]
								})]
							}, b.id))
						})]
					})
				]
			}),
			activeTab === "reports" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `space-y-6 ${bwPrint ? "print-bw-force" : ""}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "no-print flex flex-wrap items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-xl font-bold text-slate-900",
							children: "Participation Matrix & Results"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-slate-500",
							children: [
								"Print official ",
								teamLabel,
								" entry sheets or review published wins."
							]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex items-center gap-2 text-xs font-semibold text-slate-700",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: bwPrint,
									onChange: (e) => setBwPrint(e.target.checked),
									className: "h-4 w-4 rounded border-slate-300"
								}), "B&W Print"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => printPage("team-report"),
								className: "inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, { className: "h-3.5 w-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Print Report" })]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "rounded-xl border border-slate-200 bg-white p-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-base font-bold text-slate-900",
							children: "Student Participation Matrix"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 overflow-x-auto",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
								className: "w-full border-collapse text-left text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "py-2 pr-3",
											children: "Chest No"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "py-2 pr-3",
											children: "Student"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "py-2 pr-3",
											children: "Category"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "py-2",
											children: "Assigned Events"
										})
									]
								}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
									className: "divide-y divide-slate-100",
									children: scopedStudents.map((s) => {
										const evNames = (studentEventMap.get(s.id) || []).map((eid) => events.find((e) => e.id === eid)?.name).filter(Boolean);
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-2 pr-3 font-mono-num font-bold text-slate-700",
												children: s.chestNo || "—"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-2 pr-3 font-semibold text-slate-900",
												children: s.name
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-2 pr-3 text-slate-600",
												children: catName(s.category)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-2 text-slate-700",
												children: evNames.length ? evNames.join(", ") : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-slate-400",
													children: "None"
												})
											})
										] }, s.id);
									})
								})]
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "rounded-xl border border-slate-200 bg-white p-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
							className: "font-display text-base font-bold text-slate-900",
							children: [teamLabel, " Published Results"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 divide-y divide-slate-100",
							children: teamPublishedResults.length ? teamPublishedResults.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "py-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-semibold text-slate-900",
									children: [
										r.eventName,
										" · ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-normal text-slate-500",
											children: catName(r.category)
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 space-y-1 text-xs text-slate-700",
									children: r.places.filter((p) => p.winners.some((w) => w.team === teamId)).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [p.label, ":"] }),
										" ",
										p.winners.filter((w) => w.team === teamId).map((w) => w.name).join(", ")
									] }, p.key))
								})]
							}, r.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "py-6 text-center text-xs text-slate-400",
								children: [
									"No published results yet for ",
									teamLabel,
									"."
								]
							})
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Modal, {
				open: Boolean(inspectReq),
				onClose: () => setInspectReq(null),
				title: inspectReq?.name || "Application Details",
				subtitle: inspectReq ? `${catName(inspectReq.category)} · ${inspectReq.gender}` : "",
				footer: inspectReq && [
					"pending",
					"applied",
					"under_review",
					"waitlisted"
				].includes(inspectReq.status) && !registrationLocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => handleRequestDecision(inspectReq, "rejected"),
					className: "rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100",
					children: "Reject"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => handleRequestDecision(inspectReq, "approved"),
					className: "rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800",
					children: "Approve & Assign"
				})] }) : void 0,
				children: inspectReq && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3 text-xs text-slate-700",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-semibold text-slate-500",
							children: "Requested Events"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-1 list-disc pl-4",
							children: (inspectReq.eventIds || []).map((eid) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: events.find((e) => e.id === eid)?.name || eid }, eid))
						})] }),
						inspectReq.note && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-semibold text-slate-500",
							children: "Applicant Note"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 rounded-lg bg-slate-50 p-2.5",
							children: inspectReq.note
						})] }),
						inspectReq.youtubeUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-semibold text-slate-500",
							children: "YouTube Link"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 break-all text-blue-700",
							children: inspectReq.youtubeUrl
						})] }),
						inspectReq.referenceUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-semibold text-slate-500",
							children: "Reference URL"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 break-all text-blue-700",
							children: inspectReq.referenceUrl
						})] }),
						Array.isArray(inspectReq.images) && inspectReq.images[0]?.data && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-semibold text-slate-500",
							children: "Attachment"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: inspectReq.images[0].data,
							alt: "Attachment",
							className: "mt-1.5 max-h-56 rounded-lg border border-slate-200 object-contain"
						})] })
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Modal, {
				open: Boolean(manageEvent),
				onClose: () => setManageEvent(null),
				title: manageEvent ? `Manage Slots — ${manageEvent.name}` : "Manage Slots",
				subtitle: manageEvent ? `${catName(manageEvent.category)} · ${manageEvent.type} · ${manageEvent.gender} · Max ${Math.max(1, Number(manageEvent.limit || 1))} slot(s)` : "",
				maxWidthClass: "max-w-2xl",
				footer: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setManageEvent(null),
					className: "rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700",
					children: "Cancel"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: savingSlots || registrationLocked,
					onClick: saveManageSlots,
					className: "rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50",
					children: savingSlots ? "Saving…" : "Save Entries"
				})] }),
				children: manageEvent && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-4",
					children: Object.keys(slotDrafts).map((slotKey) => {
						const slotIdx = Number(slotKey);
						const selected = slotDrafts[slotIdx] || [];
						const maxMembers = manageEvent.type === "Group" ? Math.max(1, Number(manageEvent.maximumMembers || manageEvent.groupSize || 1)) : 1;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-slate-200 p-3.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center justify-between",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
									className: "text-xs font-bold text-slate-900",
									children: [
										"Slot #",
										slotIdx,
										" (",
										selected.length,
										"/",
										maxMembers,
										" selected)"
									]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2.5 grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2",
								children: [eligibleStudentsForManageEvent.map((st) => {
									const checked = selected.includes(st.id);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: `flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${checked ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700"}`,
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "checkbox",
												disabled: registrationLocked,
												checked,
												onChange: () => toggleStudentInSlot(slotIdx, st.id),
												className: "h-3.5 w-3.5 rounded border-slate-300"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "truncate font-medium",
												children: st.name
											}),
											st.chestNo && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "ml-auto font-mono-num text-[11px] text-slate-500",
												children: st.chestNo
											})
										]
									}, st.id);
								}), eligibleStudentsForManageEvent.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "col-span-2 py-4 text-center text-xs text-slate-400",
									children: [
										"No eligible students found in ",
										teamLabel,
										"."
									]
								})]
							})]
						}, slotIdx);
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Modal, {
				open: Boolean(scheduleEventModal),
				onClose: () => setScheduleEventModal(null),
				title: scheduleEventModal?.name || "Event Participants",
				subtitle: scheduleEventModal ? `${scheduleEventModal.scheduleDate || scheduleEventModal.date || "TBA"} · ${formatTime12h(scheduleEventModal.time || "")}` : "",
				children: scheduleEventModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "divide-y divide-slate-100 text-xs",
					children: (regsByEvent.get(scheduleEventModal.id) || []).map((reg) => (reg.studentIds || []).map((sid) => {
						const st = students.find((x) => x.id === sid);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold text-slate-900",
								children: st?.name || sid
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono-num text-slate-500",
								children: st?.chestNo ? `#${st.chestNo}` : `Slot ${reg.slotIndex || 1}`
							})]
						}, `${reg.id}-${sid}`);
					}))
				})
			})
		]
	});
};
export { TeamPortal };
