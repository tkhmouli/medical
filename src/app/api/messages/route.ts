import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { validateSession } from '@/lib/services/auth-service';
import { db } from '@/lib/db';
import { messages, users } from '@/lib/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';

/**
 * GET /api/messages — List conversations for the current user.
 * Returns the latest message per conversation partner.
 */
export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) {
    return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
  }

  let userInfo;
  try {
    userInfo = await validateSession(sessionCookie.value);
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
  }

  // Get conversation partner ID from query params (if fetching a specific conversation)
  const partnerId = request.nextUrl.searchParams.get('partnerId');

  if (partnerId) {
    // Fetch messages between current user and partner
    const msgs = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, userInfo.tenantId),
          or(
            and(eq(messages.senderId, userInfo.id), eq(messages.recipientId, partnerId)),
            and(eq(messages.senderId, partnerId), eq(messages.recipientId, userInfo.id))
          )
        )
      )
      .orderBy(messages.createdAt)
      .limit(100);

    // Mark unread messages as read
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.tenantId, userInfo.tenantId),
          eq(messages.senderId, partnerId),
          eq(messages.recipientId, userInfo.id),
          eq(messages.isRead, false)
        )
      );

    return NextResponse.json({ success: true, data: msgs });
  }

  // No partnerId — return list of all team members (potential conversations)
  const teamMembers = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.tenantId, userInfo.tenantId), eq(users.isActive, true)));

  // For each team member, get latest message and unread count
  const conversations = await Promise.all(
    teamMembers
      .filter(m => m.id !== userInfo.id)
      .map(async (member) => {
        const lastMsg = await db
          .select({
            content: messages.content,
            createdAt: messages.createdAt,
            senderId: messages.senderId,
          })
          .from(messages)
          .where(
            and(
              eq(messages.tenantId, userInfo.tenantId),
              or(
                and(eq(messages.senderId, userInfo.id), eq(messages.recipientId, member.id)),
                and(eq(messages.senderId, member.id), eq(messages.recipientId, userInfo.id))
              )
            )
          )
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const unreadResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(
            and(
              eq(messages.tenantId, userInfo.tenantId),
              eq(messages.senderId, member.id),
              eq(messages.recipientId, userInfo.id),
              eq(messages.isRead, false)
            )
          );

        return {
          id: member.id,
          name: member.name,
          role: member.role,
          lastMessage: lastMsg[0]?.content || null,
          lastMessageTime: lastMsg[0]?.createdAt || null,
          unread: unreadResult[0]?.count || 0,
        };
      })
  );

  // Sort by last message time (most recent first)
  conversations.sort((a, b) => {
    if (!a.lastMessageTime && !b.lastMessageTime) return 0;
    if (!a.lastMessageTime) return 1;
    if (!b.lastMessageTime) return -1;
    return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
  });

  return NextResponse.json({ success: true, data: conversations, currentUserId: userInfo.id });
}

/**
 * POST /api/messages — Send a message to a user.
 */
export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) {
    return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
  }

  let userInfo;
  try {
    userInfo = await validateSession(sessionCookie.value);
  } catch {
    return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const body = await request.json();
  const { recipientId, content } = body;

  if (!recipientId || !content?.trim()) {
    return NextResponse.json({ success: false, error: { message: 'recipientId and content required' } }, { status: 400 });
  }

  const [msg] = await db
    .insert(messages)
    .values({
      tenantId: userInfo.tenantId,
      senderId: userInfo.id,
      recipientId,
      content: content.trim(),
    })
    .returning();

  return NextResponse.json({ success: true, data: msg }, { status: 201 });
}
