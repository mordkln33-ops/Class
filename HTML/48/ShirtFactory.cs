namespace ShirtFactory
{
    internal class Shirt
    {
        public static string[] colorOptions = { "red", "blue", "green" };
        public static string[] patternOptions = { "striped", "plain", "polka dot" };
        string color;
        string pattern;

        public Shirt(string color, string pattern)
        {
            this.color = color;
            this.pattern = pattern;
        }

        public override string? ToString()
        {
            return $"Shirt: {color}, Pattern: {pattern}";
        }
    }

    internal class ShirtFactory
    {

        public static List<Shirt> CreateAllShirts()
        {
            List<Shirt> allShirts = new List<Shirt>();

            for (int i = 0; i < Shirt.colorOptions.Length; i++)
            {
                for (int j = 0; j < Shirt.patternOptions.Length; j++)
                {
                    allShirts.Add(new Shirt(Shirt.colorOptions[i], Shirt.patternOptions[j]));
                }
            }
            return allShirts;
        }

        public static void PrintShirts(List<Shirt> shirts)
        {
            foreach (Shirt shirt in shirts)
            {
                Console.WriteLine(shirt);
            }
        }

        static void Main(string[] args)
        {
            List<Shirt> newShirtList = CreateAllShirts();
            PrintShirts(newShirtList);
        }
    }
}
