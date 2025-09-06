# Birthday Splash

하나의 페이지로 친구 생일을 축하하는 웹앱 (촛불 불기 + 실시간 게스트북 옵션).

## 로컬 실행
```bash
npm i
npm run dev
```

## URL 파라미터
- `?name=혜진,성현` : 여러 명 이름 쉼표로
- `&from=한나` : 보낸 사람 서명
- `&theme=2` : 그라디언트 테마

## Vercel 배포
1. [https://vercel.com/new](https://vercel.com/new) 에서 Git 연결 없이 **Import** → `birthday-splash` 폴더 업로드
2. Framework: **Vite** 자동 인식 (Build Command: `npm run build`, Output Dir: `dist`)
3. 배포 완료 후 URL에 `?name=혜진,성현&from=한나&theme=2` 붙여서 공유

## Supabase (선택)
테이블 만들기:
```sql
create table if not exists public.guestbook (
  id bigserial primary key,
  name text,
  message text not null,
  room text not null,
  created_at timestamptz default now()
);
```
프로젝트 **URL**, **anon key**를 앱 상단 입력칸에 저장 → 실시간 ON.
설정 안 하면 브라우저 localStorage로 동작합니다.
