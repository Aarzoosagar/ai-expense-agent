from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..agent.agent import AgentError, history_for_llm, run_agent
from ..agent.tools import ToolContext, ToolError, cancel_delete, perform_delete
from ..auth import get_current_user
from ..database import get_db
from ..models import ChatMessage, User
from ..schemas import ChatIn, ChatMessageOut

router = APIRouter(prefix="/chat", tags=["chat"])

HISTORY_WINDOW = 14


def _out(m: ChatMessage) -> ChatMessageOut:
    return ChatMessageOut(id=m.id, role=m.role, content=m.content, blocks=m.blocks, created_at=m.created_at)


def _recent(db: Session, user_id: int, n: int) -> list[ChatMessage]:
    rows = list(db.scalars(select(ChatMessage).where(ChatMessage.user_id == user_id).order_by(ChatMessage.id.desc()).limit(n)))
    return rows[::-1]


@router.get("/history", response_model=list[ChatMessageOut])
def history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [_out(m) for m in _recent(db, user.id, 100)]


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
def clear_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    for m in db.scalars(select(ChatMessage).where(ChatMessage.user_id == user.id)):
        db.delete(m)
    db.commit()


@router.post("")
def chat(body: ChatIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ctx = ToolContext(db=db, user_id=user.id)

    if body.action is not None:
        # Button presses are executed deterministically — no LLM involved.
        a = body.action
        if a.type == "confirm_delete":
            user_text = "Yes, delete it."
            try:
                outcome = perform_delete(ctx, a.expense_id, require_prior_turn=False)
                e = outcome.data["expense"]
                reply_text = f"Deleted ₹{e['amount']:g} · {e['description'] or e['category']}."
                blocks = outcome.blocks
            except ToolError as err:
                reply_text, blocks = err.message, [{"type": "error", "message": err.message}]
        else:
            user_text = "No, keep it."
            cancel_delete(ctx, a.expense_id)
            reply_text, blocks = "No problem — I've kept that expense.", []
    else:
        text = body.message.strip()
        if not text:
            raise HTTPException(422, "Message is empty")
        prior = history_for_llm(_recent(db, user.id, HISTORY_WINDOW))
        try:
            reply = run_agent(ctx, user_name=user.name.split(" ")[0], message=text, history=prior)
        except AgentError as e:
            raise HTTPException(e.status_code, e.message) from e
        user_text, reply_text, blocks = text, reply.message, reply.blocks

    um = ChatMessage(user_id=user.id, role="user", content=user_text)
    am = ChatMessage(user_id=user.id, role="assistant", content=reply_text, blocks=blocks or None)
    db.add_all([um, am])
    db.commit()
    db.refresh(um)
    db.refresh(am)
    return {"user_message": _out(um), "assistant_message": _out(am)}
