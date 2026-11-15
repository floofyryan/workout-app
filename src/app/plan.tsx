import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, IconButton } from '@/components/ui';
import { getPlan, listTemplates, savePlan } from '@/db/repo';
import { useFocusQuery } from '@/lib/hooks';
import { WEEKDAY_NAMES, weekdayOf, type PlanEntry } from '@/lib/plan';
import { colors, radius, spacing } from '@/lib/theme';
import type { Template } from '@/lib/types';

/** Weekly plan editor: pick which templates to do on each day of the week. */
export default function PlanScreen() {
  const db = useSQLiteContext();
  const [data, reload] = useFocusQuery(async (d) => ({
    plan: await getPlan(d),
    templates: await listTemplates(d),
    today: weekdayOf(Date.now()),
  }));
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [copyFrom, setCopyFrom] = useState<number | null>(null);

  if (!data) return null;
  const { plan, templates, today } = data;
  const byId = new Map(templates.map((t) => [t.id, t]));

  const update = async (next: PlanEntry[]) => {
    await savePlan(db, next);
    reload();
  };
  const add = (weekday: number, templateId: number) => update([...plan, { weekday, templateId }]);
  const removeAt = (weekday: number, index: number) => {
    let i = -1;
    update(plan.filter((p) => p.weekday !== weekday || ++i !== index));
  };
  const copyDay = (from: number, to: number) =>
    update([...plan.filter((p) => p.weekday !== to), ...plan.filter((p) => p.weekday === from).map((p) => ({ ...p, weekday: to }))]);

  const trainingDays = new Set(plan.map((p) => p.weekday)).size;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <Text style={styles.intro}>
        Pick the templates you want to do on each day. Your plan repeats every week and the Workout tab shows
        what&apos;s up today.
      </Text>
      <Text style={styles.summary}>
        {trainingDays} training {trainingDays === 1 ? 'day' : 'days'} · {7 - trainingDays} rest{' '}
        {7 - trainingDays === 1 ? 'day' : 'days'}
      </Text>

      {templates.length === 0 && (
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={styles.muted}>Create a workout template first, then schedule it here.</Text>
          <Button
            title="New Template"
            icon="add"
            small
            style={{ marginTop: spacing.md }}
            onPress={() => router.push({ pathname: '/template/[id]', params: { id: 'new', kind: 'workout' } })}
          />
        </Card>
      )}

      {WEEKDAY_NAMES.map((name, weekday) => {
        const entries = plan.filter((p) => p.weekday === weekday);
        return (
          <Card key={weekday} style={[styles.day, weekday === today && styles.today]}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>
                {name}
                {weekday === today ? <Text style={styles.todayLabel}>  Today</Text> : null}
              </Text>
              {entries.length > 0 && (
                <IconButton
                  name="copy-outline"
                  size={18}
                  color={colors.muted}
                  accessibilityLabel={`Copy ${name} to another day`}
                  onPress={() => setCopyFrom(weekday)}
                />
              )}
            </View>
            {entries.length === 0 ? (
              <View style={styles.entry}>
                <Ionicons name="bed-outline" size={18} color={colors.faint} />
                <Text style={[styles.entryName, { color: colors.faint }]}>Rest day</Text>
              </View>
            ) : (
              entries.map((p, i) => {
                const t = byId.get(p.templateId);
                return (
                  <View key={i} style={styles.entry}>
                    <Ionicons
                      name={t?.kind === 'stretch' ? 'leaf-outline' : 'barbell-outline'}
                      size={18}
                      color={t?.kind === 'stretch' ? colors.success : colors.primary}
                    />
                    <Text style={styles.entryName} numberOfLines={1}>
                      {t?.name ?? 'Deleted template'}
                    </Text>
                    <Text style={styles.entryMeta}>{t ? `${t.exercises.length} ex.` : ''}</Text>
                    <IconButton
                      name="close"
                      size={18}
                      color={colors.muted}
                      accessibilityLabel={`Remove ${t?.name ?? 'template'} from ${name}`}
                      onPress={() => removeAt(weekday, i)}
                    />
                  </View>
                );
              })
            )}
            {templates.length > 0 && (
              <Button title="Add" icon="add" small variant="ghost" style={styles.addButton} onPress={() => setPickFor(weekday)} />
            )}
          </Card>
        );
      })}

      <Button
        title="Generate a program for my equipment"
        icon="sparkles-outline"
        variant="secondary"
        onPress={() => router.push('/generate')}
      />

      {plan.length > 0 && (
        <Button
          title="Clear plan"
          variant="danger"
          icon="trash-outline"
          style={{ marginTop: spacing.md }}
          onPress={() =>
            Alert.alert('Clear the weekly plan?', 'Every day becomes a rest day. Your templates are kept.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: () => update([]) },
            ])
          }
        />
      )}

      <TemplatePicker
        visible={pickFor != null}
        title={pickFor != null ? `Add to ${WEEKDAY_NAMES[pickFor]}` : ''}
        templates={templates}
        onPick={(t) => pickFor != null && add(pickFor, t.id)}
        onClose={() => setPickFor(null)}
      />
      <DayPicker
        visible={copyFrom != null}
        title={copyFrom != null ? `Copy ${WEEKDAY_NAMES[copyFrom]} to…` : ''}
        exclude={copyFrom}
        onPick={(to) => copyFrom != null && copyDay(copyFrom, to)}
        onClose={() => setCopyFrom(null)}
      />
    </ScrollView>
  );
}

function SheetModal({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 420 }}>{children}</ScrollView>
          <Pressable style={[styles.option, { justifyContent: 'center' }]} onPress={onClose}>
            <Text style={[styles.optionText, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TemplatePicker({
  visible,
  title,
  templates,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  templates: Template[];
  onPick: (t: Template) => void;
  onClose: () => void;
}) {
  const sections = [
    { label: 'Workout templates', items: templates.filter((t) => t.kind === 'workout') },
    { label: 'Stretch routines', items: templates.filter((t) => t.kind === 'stretch') },
  ].filter((s) => s.items.length > 0);
  return (
    <SheetModal visible={visible} title={title} onClose={onClose}>
      {sections.map((s) => (
        <View key={s.label}>
          <Text style={styles.sheetSection}>{s.label}</Text>
          {s.items.map((t) => (
            <Pressable
              key={t.id}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.cardAlt }]}
              onPress={() => {
                onClose();
                onPick(t);
              }}
            >
              <Ionicons
                name={t.kind === 'stretch' ? 'leaf-outline' : 'barbell-outline'}
                size={20}
                color={t.kind === 'stretch' ? colors.success : colors.primary}
                style={{ marginRight: spacing.md }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionText} numberOfLines={1}>
                  {t.name}
                </Text>
                {t.folder ? <Text style={styles.optionMeta}>{t.folder}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </SheetModal>
  );
}

function DayPicker({
  visible,
  title,
  exclude,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  exclude: number | null;
  onPick: (weekday: number) => void;
  onClose: () => void;
}) {
  return (
    <SheetModal visible={visible} title={title} onClose={onClose}>
      {WEEKDAY_NAMES.map((name, weekday) =>
        weekday === exclude ? null : (
          <Pressable
            key={weekday}
            style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.cardAlt }]}
            onPress={() => {
              onClose();
              onPick(weekday);
            }}
          >
            <Text style={styles.optionText}>{name}</Text>
          </Pressable>
        ),
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  intro: { color: colors.muted, fontSize: 14, marginBottom: spacing.sm },
  summary: { color: colors.text, fontWeight: '600', marginBottom: spacing.md },
  muted: { color: colors.muted },
  day: { marginBottom: spacing.md, padding: spacing.md },
  today: { borderColor: colors.primary },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  dayName: { color: colors.text, fontWeight: '700', fontSize: 16 },
  todayLabel: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  entryName: { color: colors.text, fontSize: 15, flex: 1 },
  entryMeta: { color: colors.faint, fontSize: 12 },
  addButton: { alignSelf: 'flex-start', marginTop: spacing.xs, paddingHorizontal: 0 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetTitle: { color: colors.text, fontWeight: '700', fontSize: 17, marginBottom: spacing.sm },
  sheetSection: { color: colors.muted, fontWeight: '700', fontSize: 13, marginTop: spacing.sm, marginBottom: spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  optionText: { color: colors.text, fontSize: 16 },
  optionMeta: { color: colors.faint, fontSize: 12, marginTop: 2 },
});
