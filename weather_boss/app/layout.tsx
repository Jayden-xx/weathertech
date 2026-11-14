import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'날씨 보스 — 오늘의 예보를 플레이하다',description:'20초 동안 날씨 보스의 공격을 피하세요. 공공 기상 데이터를 플레이로 바꾸는 인터랙티브 프로젝트.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
