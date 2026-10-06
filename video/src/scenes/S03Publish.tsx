import { C } from '../brand';
import { Callout, Mono } from '../components/Callout';
import { FootageScene } from '../components/FootageScene';
import { FRAME } from '../components/layout';
import { SLOTS } from '../footage';
import { cueAt, scene } from '../timing';

/** 0:17–0:30 · REAL /sandbox capture: clean baseline, operator publishes the controlled candidate. */
export function S03Publish() {
  const sc = scene('s03-publish');
  const s = SLOTS.sandbox;
  const tPub = cueAt('s03-publish', 'and publish one known mutation');
  const tSrc = cueAt('s03-publish', 'of real HadeethEnc');
  return (
    <FootageScene n="01" chapter="Live sandbox" layer="src" slot={s} frames={sc.frames}>
      <Callout at={0.8} until={tPub - 0.2} x={48} y={48} w={470} anchor={s.anchors.baseline} icon="shield-check" iconColor={C.tq} label="Clean baseline">
        Latest <Mono>v13</Mono> · Trusted <Mono>v13</Mono> · Served <Mono color={C.tq}>v13</Mono>
      </Callout>
      <Callout at={tPub} x={FRAME.w - 48 - 440} y={620} w={440} anchor={s.anchors.publish} icon="arrow-up-right" iconColor={C.ink} label="Operator action">
        Publish controlled candidate
      </Callout>
      <Callout at={tSrc} x={48} y={FRAME.h - 48 - 112} w={640} layer="src" label={<>Real source · HadeethEnc <Mono>10618</Mono></>}>
        <span style={{ fontSize: 20, lineHeight: '27px', color: C.ink2 }}>One known mutation, created by Istithbat for testing. Not published by HadeethEnc.</span>
      </Callout>
    </FootageScene>
  );
}
