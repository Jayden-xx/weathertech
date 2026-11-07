"""학습·자동 검사 전용 모의 응답. 실제 API 데이터가 아닙니다."""
import copy

def payload(item):
    return {'response':{'header':{'resultCode':'00','resultMsg':'NORMAL_SERVICE'},'body':{'dataType':'JSON','items':{'item':[item]},'pageNo':1,'numOfRows':10,'totalCount':1}}}

def fixture(page,code,issue):
    if page=='outlook':
        return payload({'wfSv':'[모의 응답 · 실제 예보 아님]\n\n○ (날씨) 화면과 줄바꿈 표시를 확인하기 위한 학습용 전망문입니다.\n○ (안내) 실제 강수 시점과 기온은 인증키 설정 후 기상청 응답에서 확인하세요.\n\n이 문장에서 수치 예보를 생성하지 않습니다.'})
    item={'regId':code}
    for day in range(4 if issue[8:10]=='06' else 5,11):
        if page=='temperature':
            item.update({f'taMin{day}':[3,4,6,7,9,8,5][day-4],f'taMax{day}':[15,16,16,16,13,15,12][day-4],f'taMin{day}Low':0,f'taMin{day}High':1})
        else:
            for part in ('Am','Pm') if day<8 else ('',):
                item[f'wf{day}{part}']='흐리고 비' if day==7 and part=='Pm' else '구름많음' if day in (7,9) else '흐림' if day==8 else '맑음'
                if page=='land': item[f'rnSt{day}{part}']=60 if day==7 and part=='Pm' else 30 if day==8 else 20 if day in (7,9) else 10
                else:
                    item[f'wh{day}A{part}']=0.5+(day%3)*0.5
                    item[f'wh{day}B{part}']=1.5+(day%3)*0.5
    return payload(copy.deepcopy(item))
