import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import type { AuctionRoom, AuctionStatus, Session } from '@elite/shared';
import { AuctionRoomPage } from '../src/auction-pages';

const session:Session={token:'local-ui-test',user:{id:'bidder',name:'Teste',role:'LICITANTE',publicId:'public-bidder'}};
function renderRoom(status:AuctionStatus) {
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity,gcTime:0}}});
  const room:AuctionRoom={serverTime:'2026-10-28T12:00:00Z',bids:[],auction:{
    id:'lot',item:{catalogId:'OL1W',title:'Livro teste',authors:[],firstPublishYear:null,image:null,sourceUrl:'https://openlibrary.org/works/OL1W',importedAt:'2026-10-28T10:00:00Z'},
    initialCents:1000,incrementCents:100,currentCents:null,leaderPublicId:null,bidCount:0,
    startsAt:'2026-10-28T11:00:00Z',endsAt:'2026-10-28T13:00:00Z',cancelledAt:null,settledAt:null,status,
  }};
  client.setQueryData(['auction','lot'],room);
  client.setQueryData(['wallet','bidder'],{totalCents:10000,committedCents:0,availableCents:10000});
  const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(MemoryRouter,{initialEntries:['/lotes/lot']},createElement(Routes,null,createElement(Route,{path:'/lotes/:id',element:createElement(AuctionRoomPage,{session})})))));
  client.clear();return html;
}
it('offers bidding in an active auction',()=>{
  const html=renderRoom('AO_VIVO');expect(html).toContain('Seu lance (R$)');expect(html).toContain('Oferecer lance');
});
it.each(['AGENDADO','ENCERRADO','CANCELADO'] as const)('does not present a bid form for %s',status=>{
  const html=renderRoom(status);expect(html).not.toContain('Seu lance (R$)');expect(html).not.toContain('Oferecer lance');
  expect(html).toContain('Histórico de lances');expect(html).toContain('Auditoria pública');
  if(status==='ENCERRADO')expect(html).toContain('Lote encerrado sem lances e sem vencedor.');
});
