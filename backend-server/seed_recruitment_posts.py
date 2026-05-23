from datetime import datetime

from app.auth import hash_password
from app.database import SessionLocal, init_db
from app.models import Post, PostTag, Tag, User


SEED_PASSWORD = "Password123"

SEED_USERS = [
    {
        "username": "frontend_campus",
        "email": "frontend-campus@example.com",
        "display_name": "前端秋招观察员",
        "bio": "记录前端工程、跨端与校招面经",
    },
    {
        "username": "backend_offer",
        "email": "backend-offer@example.com",
        "display_name": "后端Offer雷达",
        "bio": "关注后端开发、数据库、分布式和工程实践",
    },
    {
        "username": "llm_interns",
        "email": "llm-interns@example.com",
        "display_name": "大模型实习情报站",
        "bio": "整理 AI 大模型、算法工程和应用开发机会",
    },
    {
        "username": "campus_hr_bot",
        "email": "campus-hr-bot@example.com",
        "display_name": "校招信息搬运工",
        "bio": "发布互联网秋招、提前批和实习转正信息",
    },
]

SEED_POSTS = [
    {
        "author": "frontend_campus",
        "title": "2026 秋招前端岗位汇总：React、Vue 与跨端方向",
        "summary": "整理近期开放的前端校招岗位，重点关注 React Native、小程序、工程化和性能优化要求。",
        "body": "近期前端秋招岗位普遍要求扎实的 JavaScript/TypeScript 基础，熟悉 React 或 Vue 至少一种框架。部分团队强调跨端经验，例如 React Native、Flutter、小程序和 Expo。建议准备项目时突出组件设计、状态管理、性能优化、首屏加载和工程化能力。面试高频问题包括事件循环、浏览器渲染、虚拟列表、缓存策略、构建工具和前端安全。",
        "tags": ["秋招", "前端", "React", "TypeScript"],
    },
    {
        "author": "frontend_campus",
        "title": "前端秋招简历怎么写：项目经历比技术栈堆砌更重要",
        "summary": "简历建议围绕业务问题、技术方案、性能指标和个人贡献展开。",
        "body": "很多前端同学会在简历中堆满 React、Vue、Webpack、Vite、Node.js 等关键词，但面试官更关注你如何解决具体问题。建议每个项目写清楚背景、难点、方案和结果。例如将列表渲染从全量渲染改为虚拟列表，滚动卡顿从明显掉帧优化到稳定；或者通过分包、懒加载和缓存减少首屏时间。",
        "tags": ["秋招", "前端", "简历"],
    },
    {
        "author": "backend_offer",
        "title": "后端秋招岗位观察：Java、Go 与 Python 服务端方向",
        "summary": "后端岗位仍然重视基础：网络、操作系统、数据库、缓存和并发。",
        "body": "后端秋招岗位中，Java 和 Go 需求依然稳定，Python 更多出现在平台工具、数据服务和 AI 应用后端方向。准备时建议重点复习 HTTP/TCP、线程和协程、MySQL 索引与事务、Redis 缓存、消息队列、接口幂等和限流降级。项目最好能说明数据模型设计、接口性能、异常处理和可观测性。",
        "tags": ["秋招", "后端", "Java", "Go", "Python"],
    },
    {
        "author": "backend_offer",
        "title": "后端面试高频：数据库索引、事务和接口幂等",
        "summary": "从真实业务出发准备数据库和接口设计题。",
        "body": "数据库问题常从慢查询开始追问：为什么建这个索引、联合索引顺序如何选择、覆盖索引是什么、事务隔离级别如何影响并发。接口设计题则常考幂等、重复提交、订单状态流转、分布式锁和消息补偿。建议用一个完整项目串起这些知识点，而不是孤立背答案。",
        "tags": ["秋招", "后端", "数据库", "面试"],
    },
    {
        "author": "llm_interns",
        "title": "AI 大模型秋招方向：应用开发、平台工程与算法岗区别",
        "summary": "大模型相关岗位不只有算法，LLM 应用和平台工程也大量招人。",
        "body": "AI 大模型秋招岗位可以粗略分为三类：算法研究、平台工程和应用开发。算法岗更看重机器学习基础、论文理解和训练经验；平台工程关注推理服务、GPU 调度、模型部署和稳定性；应用开发则强调 RAG、Agent、工具调用、评测体系和业务落地。如果没有训练大模型经验，可以从 LLM 应用项目切入，展示检索、提示词、函数调用和效果评估能力。",
        "tags": ["秋招", "AI", "大模型", "LLM"],
    },
    {
        "author": "llm_interns",
        "title": "大模型应用开发校招项目建议：RAG 知识库如何讲清楚",
        "summary": "RAG 项目要讲清楚数据清洗、切分、召回、重排、生成和评测。",
        "body": "RAG 知识库项目很常见，但要避免只写调用 API。可以重点描述文档解析、chunk 策略、embedding 模型选择、向量库、混合检索、rerank、引用溯源和回答评测。面试时可能追问幻觉、召回不足、上下文过长、权限隔离和增量更新。最好准备一些真实评测样例和对比指标。",
        "tags": ["秋招", "AI", "RAG", "大模型"],
    },
    {
        "author": "campus_hr_bot",
        "title": "互联网秋招投递节奏：提前批、正式批与补录",
        "summary": "秋招节奏很快，建议提前准备简历、项目复盘和笔试练习。",
        "body": "互联网秋招通常从提前批开始，随后进入正式批，部分公司还有补录。提前批更适合准备充分、项目亮点明确的同学，正式批岗位更多但竞争也更集中。建议建立投递表，记录公司、岗位、进度、笔试时间和面试复盘。前端、后端和 AI 应用方向都需要提前准备可讲清楚的项目。",
        "tags": ["秋招", "校招", "投递"],
    },
    {
        "author": "campus_hr_bot",
        "title": "前后端与 AI 岗位通用准备清单",
        "summary": "基础知识、项目表达、代码能力和业务理解都不能缺。",
        "body": "无论投递前端、后端还是 AI 大模型相关岗位，都建议准备四类内容：第一，基础知识，包括语言、网络、数据库和系统设计；第二，项目复盘，讲清楚背景、方案、难点和结果；第三，代码能力，保持算法题和工程代码手感；第四，业务理解，知道技术方案如何服务真实用户和产品目标。",
        "tags": ["秋招", "前端", "后端", "AI"],
    },
]

INTERVIEW_QUESTIONS = [
    ("解释浏览器事件循环中宏任务和微任务的执行顺序", "事件循环", "前端"),
    ("React 中 key 的作用是什么，为什么不建议使用数组下标", "React", "前端"),
    ("如何实现虚拟列表，它解决了什么性能问题", "性能优化", "前端"),
    ("移动端适配中 rem、vw 和安全区分别适合什么场景", "移动端", "前端"),
    ("React Native 的 JS 线程和 UI 线程如何协作", "React Native", "移动端"),
    ("什么是闭包，闭包在实际项目中有哪些使用和风险", "JavaScript", "前端"),
    ("CSS BFC 是什么，可以解决哪些布局问题", "CSS", "前端"),
    ("如何排查移动端页面滚动卡顿", "性能优化", "移动端"),
    ("TypeScript 中 interface 和 type 的区别", "TypeScript", "前端"),
    ("Webpack 和 Vite 的开发构建机制有什么区别", "工程化", "前端"),
    ("前端如何做接口请求的取消、重试和并发控制", "网络请求", "前端"),
    ("如何设计一个可复用的表单组件", "组件设计", "前端"),
    ("小程序和 H5 在运行环境上有哪些差异", "小程序", "移动端"),
    ("如何处理前端权限控制和路由守卫", "权限", "前端"),
    ("什么是首屏性能优化，常见指标有哪些", "性能优化", "前端"),
    ("React Hooks 为什么不能写在条件语句里", "React", "前端"),
    ("移动端 1px 边框问题如何处理", "移动端", "前端"),
    ("如何实现图片懒加载和预加载", "性能优化", "前端"),
    ("前端缓存有哪些层级，如何选择缓存策略", "缓存", "前端"),
    ("如何防止 XSS 和 CSRF 攻击", "安全", "前端"),
]


def build_interview_posts() -> list[dict]:
    posts = []
    authors = ["frontend_campus", "campus_hr_bot"]
    for index in range(1, 1001):
        question, topic, direction = INTERVIEW_QUESTIONS[(index - 1) % len(INTERVIEW_QUESTIONS)]
        posts.append(
            {
                "author": authors[index % len(authors)],
                "title": f"前端/移动端面经第 {index:04d} 题：{question}",
                "summary": f"秋招高频面试题：{topic}。建议从概念、项目场景、边界问题和优化方案四个角度回答。",
                "body": (
                    f"问题：{question}\n\n"
                    f"回答建议：先说明核心概念，再结合真实项目说明你遇到的问题、采用的方案和结果。"
                    f"如果是 {direction} 方向岗位，面试官通常会继续追问边界条件、性能影响、异常处理和团队协作中的取舍。"
                    "准备时不要只背定义，最好能补充一段你在项目中如何验证方案有效的经历。"
                ),
                "tags": ["秋招", "面经", direction, topic],
            }
        )
    return posts


def get_or_create_tag(db, name: str) -> Tag:
    tag = db.query(Tag).filter(Tag.name == name).first()
    if tag is None:
        tag = Tag(name=name)
        db.add(tag)
        db.flush()
    return tag


def seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        users: dict[str, User] = {}
        created_users = 0
        created_posts = 0

        for item in SEED_USERS:
            user = db.query(User).filter(User.username == item["username"]).first()
            if user is None:
                user = User(
                    username=item["username"],
                    email=item["email"],
                    password_hash=hash_password(SEED_PASSWORD),
                    display_name=item["display_name"],
                    bio=item["bio"],
                    status="active",
                )
                db.add(user)
                db.flush()
                created_users += 1
            users[item["username"]] = user

        for item in [*SEED_POSTS, *build_interview_posts()]:
            exists = db.query(Post).filter(Post.title == item["title"]).first()
            if exists is not None:
                continue
            post = Post(
                author_id=users[item["author"]].id,
                title=item["title"],
                summary=item["summary"],
                body=item["body"],
                visibility="public",
                status="published",
                like_count=0,
                comment_count=0,
                favorite_count=0,
                published_at=datetime.utcnow(),
            )
            db.add(post)
            db.flush()
            for tag_name in item["tags"]:
                tag = get_or_create_tag(db, tag_name)
                db.add(PostTag(post_id=post.id, tag_id=tag.id))
            created_posts += 1

        db.commit()
        print(f"created_users={created_users} created_posts={created_posts}")
        print(f"seed_password={SEED_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
