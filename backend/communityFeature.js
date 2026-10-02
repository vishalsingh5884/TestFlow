import { readBlobJSON, writeBlobJSON } from "./netlifyBlobs.js";

import crypto from "crypto";

export function registerCommunityRoutes({
  app,
  DATA_DIR,
  users,
  sessions,
  adminAccounts,
  authenticateAdmin,
  authenticateStudent,
}) {
  const COMMUNITY_KEYS = {
    groups: "community-groups",
    groupMessages: "community-group-messages",
    groupInvites: "community-group-invites",
    notifications: "community-notifications",
    privateMessages: "community-private-messages",
  };

  let groups = [];
  let groupMessages = [];
  let groupInvites = [];
  let notifications = [];
  let privateMessages = [];

  const loadCommunityData = async () => {
    try {
      const [
        storedGroups,
        storedGroupMessages,
        storedGroupInvites,
        storedNotifications,
        storedPrivateMessages,
      ] = await Promise.all([
        readBlobJSON(COMMUNITY_KEYS.groups, []),
        readBlobJSON(COMMUNITY_KEYS.groupMessages, []),
        readBlobJSON(COMMUNITY_KEYS.groupInvites, []),
        readBlobJSON(COMMUNITY_KEYS.notifications, []),
        readBlobJSON(COMMUNITY_KEYS.privateMessages, []),
      ]);

      groups = Array.isArray(storedGroups) ? storedGroups : [];
      groupMessages = Array.isArray(storedGroupMessages) ? storedGroupMessages : [];
      groupInvites = Array.isArray(storedGroupInvites) ? storedGroupInvites : [];
      notifications = Array.isArray(storedNotifications) ? storedNotifications : [];
      privateMessages = Array.isArray(storedPrivateMessages) ? storedPrivateMessages : [];

      console.log(
        "Community data loaded from Netlify Blobs:",
        groups.length,
        "groups,",
        groupMessages.length,
        "group messages,",
        groupInvites.length,
        "invites,",
        notifications.length,
        "notifications,",
        privateMessages.length,
        "private messages.",
      );
    } catch (error) {
      console.error("Failed to load community data from Netlify Blobs:", error);
      groups = [];
      groupMessages = [];
      groupInvites = [];
      notifications = [];
      privateMessages = [];
    }
  };

  const saveAll = () => {
    Promise.all([
      writeBlobJSON(COMMUNITY_KEYS.groups, groups),
      writeBlobJSON(COMMUNITY_KEYS.groupMessages, groupMessages),
      writeBlobJSON(COMMUNITY_KEYS.groupInvites, groupInvites),
      writeBlobJSON(COMMUNITY_KEYS.notifications, notifications),
      writeBlobJSON(COMMUNITY_KEYS.privateMessages, privateMessages),
    ]).catch((error) => {
      console.error("Failed to persist community data:", error);
    });
  };

  const publicUser = (user) => user ? ({
    id: String(user.id),
    name: String(user.name || "User"),
    email: String(user.email || ""),
    role: String(user.role || "student"),
    isPrimary: Boolean(user.isPrimary),
    studentId: user.studentId ? String(user.studentId) : null,
  }) : null;

  const findUser = (id) => users.get(String(id)) || null;
  const isAdmin = (user) => user && (user.role === "admin" || user.role === "primary-admin");

  const anyAuth = (req, res, next) => {
    try {
      const header = String(req.headers.authorization || "").trim();
      if (!header.startsWith("Bearer ")) return res.status(401).json({ success:false, message:"Login required." });
      const token = header.slice(7).trim();
      const session = sessions.get(token);
      if (!session?.userId) return res.status(401).json({ success:false, message:"Invalid or expired login session." });
      const user = findUser(session.userId);
      if (!user) return res.status(401).json({ success:false, message:"User account not found." });
      req.user = user;
      req.sessionToken = token;
      next();
    } catch {
      res.status(401).json({ success:false, message:"Invalid or expired login session." });
    }
  };

  const groupFor = (id) => groups.find((group) => group.id === String(id));
  const member = (group, userId) => group?.members?.find((item) => String(item.userId) === String(userId));
  const groupAdmin = (group, userId) => {
    const m = member(group, userId);
    return Boolean(m && m.role === "admin");
  };
  const canSeeGroup = (group, user) => Boolean(group && (groupAdmin(group, user.id) || member(group, user.id)));
  const canChat = (group, user) => {
    if (groupAdmin(group, user.id)) return true;
    const mode = group.settings?.chatMode || "everyone";
    if (mode === "admins") return false;
    if (mode === "selected") return (group.settings?.chatMemberIds || []).map(String).includes(String(user.id));
    return true;
  };
  const canViewMessage = (group, message, user) => {
    if (groupAdmin(group, user.id)) return true;
    if (String(message.senderId) === String(user.id)) return true;
    const audience = message.audience || "everyone";
    if (audience === "admins") return false;
    if (audience === "selected") return (message.recipientIds || []).map(String).includes(String(user.id));
    return true;
  };
  const safeGroup = (group, user) => ({
    ...group,
    members: (group.members || []).map((m) => ({ ...m, user: publicUser(findUser(m.userId)) })),
    canAdmin: groupAdmin(group, user.id),
    canChat: canChat(group, user),
  });

  const createNotification = (userId, payload) => {
    const item = {
      id: crypto.randomUUID(),
      userId: String(userId),
      type: String(payload.type || "INFO"),
      title: String(payload.title || "Notification"),
      message: String(payload.message || ""),
      data: payload.data || {},
      read: false,
      createdAt: new Date().toISOString(),
    };
    notifications.unshift(item);
    saveAll();
    return item;
  };

  const createNotificationForAllStudents = (payload) => {
    for (const user of users.values()) {
      if (user?.role === "student") createNotification(user.id, payload);
    }
  };

  app.get("/api/community/users", anyAuth, (req, res) => {
    const list = [...users.values()]
      .filter((user) => user && (user.role === "student" || isAdmin(user)))
      .map(publicUser)
      .filter(Boolean)
      .sort((a,b) => a.name.localeCompare(b.name));
    res.json({ success:true, users:list });
  });

  app.get("/api/groups", anyAuth, (req, res) => {
    const visible = groups.filter((group) => canSeeGroup(group, req.user));
    res.json({ success:true, groups:visible.map((g) => safeGroup(g, req.user)) });
  });

  app.post("/api/groups", authenticateAdmin, (req, res) => {
    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();
    if (!name) return res.status(400).json({ success:false, message:"Group name is required." });
    const group = {
      id: crypto.randomUUID(),
      name,
      description,
      createdBy: req.user.id,
      admins: [req.user.id],
      members: [{ userId:req.user.id, role:"admin", joinedAt:new Date().toISOString() }],
      settings: {
        chatMode: ["everyone","admins","selected"].includes(req.body?.chatMode) ? req.body.chatMode : "everyone",
        chatMemberIds: Array.isArray(req.body?.chatMemberIds) ? req.body.chatMemberIds.map(String) : [],
      },
      resources: { timetable:[], notes:[], assignments:[] },
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
    };
    groups.unshift(group);
    saveAll();
    res.status(201).json({ success:true, group:safeGroup(group, req.user) });
  });

  app.get("/api/groups/:groupId", anyAuth, (req, res) => {
    const group = groupFor(req.params.groupId);
    if (!group || !canSeeGroup(group, req.user)) return res.status(404).json({ success:false, message:"Group not found." });
    res.json({ success:true, group:safeGroup(group, req.user) });
  });

  app.post("/api/groups/:groupId/invites", authenticateAdmin, (req, res) => {
    const group = groupFor(req.params.groupId);
    if (!group || !groupAdmin(group, req.user.id)) return res.status(403).json({ success:false, message:"Only group admins can invite members." });
    const ids = Array.isArray(req.body?.userIds) ? req.body.userIds.map(String) : [];
    const role = req.body?.role === "admin" ? "admin" : "member";
    const invited = [];
    for (const userId of ids) {
      const target = findUser(userId);
      if (!target || !(target.role === "student" || isAdmin(target))) continue;
      if (member(group, userId)) continue;
      if (groupInvites.some((i) => i.groupId === group.id && i.userId === userId && i.status === "pending")) continue;
      const invite = { id:crypto.randomUUID(), groupId:group.id, userId, role, invitedBy:req.user.id, status:"pending", createdAt:new Date().toISOString() };
      groupInvites.unshift(invite);
      invited.push(invite);
      createNotification(userId, { type:"GROUP_INVITE", title:"Group invitation", message:`${req.user.name || "An admin"} invited you to join ${group.name}.`, data:{ inviteId:invite.id, groupId:group.id, groupName:group.name, role } });
    }
    saveAll();
    res.json({ success:true, invitedCount:invited.length, invites:invited });
  });

  app.get("/api/group-invites", anyAuth, (req, res) => {
    const mine = groupInvites.filter((i) => i.userId === String(req.user.id) && i.status === "pending").map((i) => ({ ...i, group:groupFor(i.groupId) ? { id:i.groupId, name:groupFor(i.groupId).name, description:groupFor(i.groupId).description } : null }));
    res.json({ success:true, invites:mine });
  });

  app.post("/api/group-invites/:inviteId/accept", anyAuth, (req, res) => {
    const invite = groupInvites.find((i) => i.id === String(req.params.inviteId) && i.userId === String(req.user.id) && i.status === "pending");
    if (!invite) return res.status(404).json({ success:false, message:"Invitation not found." });
    const group = groupFor(invite.groupId);
    if (!group) return res.status(404).json({ success:false, message:"Group no longer exists." });
    if (!member(group, req.user.id)) group.members.push({ userId:String(req.user.id), role:invite.role === "admin" ? "admin" : "member", joinedAt:new Date().toISOString() });
    if (invite.role === "admin" && !group.admins.map(String).includes(String(req.user.id))) group.admins.push(String(req.user.id));
    invite.status = "accepted";
    invite.respondedAt = new Date().toISOString();
    group.updatedAt = new Date().toISOString();
    saveAll();
    res.json({ success:true, message:"Invitation accepted.", group:safeGroup(group, req.user) });
  });

  app.post("/api/group-invites/:inviteId/decline", anyAuth, (req, res) => {
    const invite = groupInvites.find((i) => i.id === String(req.params.inviteId) && i.userId === String(req.user.id) && i.status === "pending");
    if (!invite) return res.status(404).json({ success:false, message:"Invitation not found." });
    invite.status = "declined";
    invite.respondedAt = new Date().toISOString();
    saveAll();
    res.json({ success:true, message:"Invitation declined." });
  });

  app.post("/api/groups/:groupId/resources", authenticateAdmin, (req, res) => {
    const group = groupFor(req.params.groupId);
    if (!group || !groupAdmin(group, req.user.id)) return res.status(403).json({ success:false, message:"Only group admins can add resources." });
    const type = ["timetable","notes","assignments"].includes(req.body?.type) ? req.body.type : null;
    const title = String(req.body?.title || "").trim();
    const content = String(req.body?.content || "").trim();
    if (!type || !title || !content) return res.status(400).json({ success:false, message:"Type, title and content are required." });
    const resource = { id:crypto.randomUUID(), title, content, createdBy:req.user.id, createdAt:new Date().toISOString() };
    group.resources ||= { timetable:[], notes:[], assignments:[] };
    group.resources[type] ||= [];
    group.resources[type].unshift(resource);
    group.updatedAt = new Date().toISOString();
    saveAll();
    res.status(201).json({ success:true, resource, group:safeGroup(group, req.user) });
  });

  app.get("/api/groups/:groupId/messages", anyAuth, (req, res) => {
    const group = groupFor(req.params.groupId);
    if (!group || !canSeeGroup(group, req.user)) return res.status(404).json({ success:false, message:"Group not found." });
    const messages = groupMessages.filter((m) => m.groupId === group.id && canViewMessage(group,m,req.user)).map((m) => ({ ...m, sender:publicUser(findUser(m.senderId)) }));
    res.json({ success:true, messages });
  });

  app.post("/api/groups/:groupId/messages", anyAuth, (req, res) => {
    const group = groupFor(req.params.groupId);
    if (!group || !canSeeGroup(group, req.user)) return res.status(404).json({ success:false, message:"Group not found." });
    if (!canChat(group, req.user)) return res.status(403).json({ success:false, message:"You are not allowed to chat in this group." });
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ success:false, message:"Message is required." });
    const audience = ["everyone","admins","selected"].includes(req.body?.audience) ? req.body.audience : "everyone";
    const recipientIds = Array.isArray(req.body?.recipientIds) ? req.body.recipientIds.map(String) : [];
    if (!groupAdmin(group, req.user.id) && audience !== "everyone") return res.status(403).json({ success:false, message:"Only group admins can restrict message visibility." });
    if (audience === "selected" && !recipientIds.length) return res.status(400).json({ success:false, message:"Select at least one recipient." });
    const message = { id:crypto.randomUUID(), groupId:group.id, senderId:req.user.id, body, audience, recipientIds, createdAt:new Date().toISOString() };
    groupMessages.push(message);
    saveAll();
    const recipients = audience === "selected" ? recipientIds : group.members.map((m) => String(m.userId));
    for (const userId of recipients) if (userId !== String(req.user.id)) createNotification(userId, { type:"GROUP_MESSAGE", title:group.name, message:body, data:{ groupId:group.id, messageId:message.id } });
    res.status(201).json({ success:true, message:{ ...message, sender:publicUser(req.user) } });
  });

  app.get("/api/notifications", anyAuth, (req, res) => {
    const mine = notifications.filter((n) => n.userId === String(req.user.id));
    res.json({ success:true, notifications:mine, unreadCount:mine.filter((n) => !n.read).length });
  });

  app.post("/api/notifications/:notificationId/read", anyAuth, (req, res) => {
    const item = notifications.find((n) => n.id === String(req.params.notificationId) && n.userId === String(req.user.id));
    if (!item) return res.status(404).json({ success:false, message:"Notification not found." });
    item.read = true;
    saveAll();
    res.json({ success:true, notification:item });
  });

  app.post("/api/notifications/read-all", anyAuth, (req, res) => {
    for (const item of notifications) if (item.userId === String(req.user.id)) item.read = true;
    saveAll();
    res.json({ success:true });
  });

  app.get("/api/messages", anyAuth, (req, res) => {
    const list = [...users.values()].filter((u) => u.id !== req.user.id && (u.role === "student" || isAdmin(u))).map(publicUser);
    res.json({ success:true, users:list });
  });

  app.get("/api/messages/:userId", anyAuth, (req, res) => {
    const other = findUser(req.params.userId);
    if (!other) return res.status(404).json({ success:false, message:"User not found." });
    const conversation = privateMessages.filter((m) => (String(m.fromUserId) === String(req.user.id) && String(m.toUserId) === String(other.id)) || (String(m.fromUserId) === String(other.id) && String(m.toUserId) === String(req.user.id))).map((m) => ({ ...m, from:publicUser(findUser(m.fromUserId)), to:publicUser(findUser(m.toUserId)) }));
    for (const m of privateMessages) if (m.fromUserId === String(other.id) && m.toUserId === String(req.user.id)) m.read = true;
    saveAll();
    res.json({ success:true, user:publicUser(other), messages:conversation });
  });

  app.post("/api/messages/:userId", anyAuth, (req, res) => {
    const other = findUser(req.params.userId);
    if (!other) return res.status(404).json({ success:false, message:"User not found." });
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ success:false, message:"Message is required." });
    const message = { id:crypto.randomUUID(), fromUserId:String(req.user.id), toUserId:String(other.id), body, read:false, createdAt:new Date().toISOString() };
    privateMessages.push(message);
    saveAll();
    createNotification(other.id, { type:"PRIVATE_MESSAGE", title:`Message from ${req.user.name || "User"}`, message:body, data:{ userId:String(req.user.id), messageId:message.id } });
    res.status(201).json({ success:true, message:{ ...message, from:publicUser(req.user), to:publicUser(other) } });
  });

  return {
    createNotification,
    createNotificationForAllStudents,
    loadCommunityData,
  };
}

