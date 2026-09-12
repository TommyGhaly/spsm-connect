/**
 * A screen that exists so the tab bar is not rearranged later.
 *
 * The tab set is a decision — Home, Calendar, Photos, More — and it is worth
 * making once rather than growing a tab at a time and moving everything each
 * time. So the routes exist now and two of them are honest about being empty.
 *
 * Honest is the operative word: this says the screen is not built rather than
 * showing a spinner, an empty state, or a plausible-looking shell. A person who
 * finds an empty Calendar should know it is unfinished and not conclude that the
 * parish has no services this week.
 *
 * Delete this file when the last caller goes.
 */
import { Card, Screen } from './Surface';
import { Body, Label } from './Type';
import { useTheme } from '@/theme/ThemeProvider';

export function Unbuilt({ what }: { what: string }) {
  const theme = useTheme();

  return (
    <Screen>
      <Card>
        <Label>Not built yet</Label>
        <Body color={theme.color.inkSoft}>
          {what} is on the website, and is coming here next. Nothing is missing from the parish —
          only from this app.
        </Body>
      </Card>
    </Screen>
  );
}
